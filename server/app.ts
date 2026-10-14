import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import helmet from 'helmet'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { rateLimit, ipKeyGenerator, type Store } from 'express-rate-limit'
import type { Config } from './config.js'
import { contactSchema, privateKey, sendContact, verifyChallenge, type Fetch } from './contact.js'

type Dependencies = {
  store?: (namespace: string) => Store
  ready?: () => boolean
  fetcher?: Fetch
  audit?: (event: { event: string; requestId: string }) => void
  staticDir?: string
}

export function createApp(config: Config, deps: Dependencies = {}) {
  if (config.enabled && !deps.store) throw new Error('Persistent rate-limit storage is required')
  const app = express()
  const fetcher = deps.fetcher ?? fetch
  const ready = deps.ready ?? (() => true)
  const audit = deps.audit ?? (() => {})
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy.length ? config.trustProxy : false)
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://challenges.cloudflare.com'],
      frameSrc: ['https://challenges.cloudflare.com'],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"], baseUri: ["'none'"],
      formAction: ["'self'"], frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.environment === 'production' ? [] : null,
    } },
    strictTransportSecurity: config.environment === 'production' ? { maxAge: 31536000, includeSubDomains: false } : false,
    crossOriginEmbedderPolicy: false,
  }))
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    next()
  })
  app.use('/api', (_req, res, next) => {
    res.locals.requestId = randomUUID()
    res.setHeader('X-Request-ID', res.locals.requestId)
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.get('/api/health', (_req, res) => {
    res.status(ready() ? 200 : 503).json({ ok: ready() })
  })
  app.get('/api/contact/config', (_req, res) => {
    res.json({ enabled: config.enabled, siteKey: config.enabled ? config.siteKey : null })
  })

  const guard: RequestHandler = (req, res, next) => {
    if (!config.enabled || !ready()) return void res.status(503).json({ error: 'Contact is temporarily unavailable. Please email me directly.' })
    if (req.get('Origin') !== config.origin || req.get('Sec-Fetch-Site') === 'cross-site') {
      return void res.status(403).json({ error: 'Request origin is not allowed.' })
    }
    if (!req.is('application/json') || (req.get('Content-Encoding') && req.get('Content-Encoding') !== 'identity')) {
      return void res.status(415).json({ error: 'Use an uncompressed JSON request.' })
    }
    next()
  }
  const makeLimit = (namespace: string, limit: number, windowMs: number, key: (req: express.Request) => string) => rateLimit({
    windowMs, limit, store: deps.store?.(namespace),
    keyGenerator: key, standardHeaders: 'draft-7', legacyHeaders: false,
    passOnStoreError: false,
    message: { error: 'Too many attempts. Please try again later or email me directly.' },
  })
  const limiters = config.enabled ? {
    ip: makeLimit('ip', 5, 15 * 60_000, req => privateKey(config.rateLimitSecret, 'ip', ipKeyGenerator(req.ip ?? 'unknown', 56))),
    email: makeLimit('email', 3, 60 * 60_000, req => privateKey(config.rateLimitSecret, 'email', String(req.body.email).toLowerCase())),
    global: makeLimit('global', 100, 60 * 60_000, () => 'all'),
  } : null
  const skip: RequestHandler = (_req, _res, next) => next()
  app.post('/api/contact', guard, limiters?.ip ?? skip,
    express.json({ limit: '32kb', strict: true, inflate: false }),
    async (req, res, next) => {
      const parsed = contactSchema.safeParse(req.body)
      if (!parsed.success || parsed.data.website !== '') {
        res.status(400).json({ error: 'Please check the form fields and try again.' })
        return
      }
      req.body = parsed.data
      try {
        if (!await verifyChallenge(config, parsed.data.token, req.ip ?? '', fetcher)) {
          res.status(400).json({ error: 'Verification expired or failed. Please verify again.' })
          return
        }
      } catch {
        audit({ event: 'verification_unavailable', requestId: res.locals.requestId })
        res.status(503).json({ error: 'Verification is unavailable. Please try again or email me directly.' })
        return
      }
      next()
    },
    limiters?.email ?? skip, limiters?.global ?? skip,
    async (req, res) => {
      try {
        await sendContact(config, req.body, fetcher)
        audit({ event: 'message_accepted', requestId: res.locals.requestId })
        res.status(202).json({ ok: true })
      } catch {
        audit({ event: 'delivery_unavailable', requestId: res.locals.requestId })
        res.status(502).json({ error: 'Your message could not be confirmed. Please try again or email me directly.' })
      }
    },
  )
  app.all('/api/contact', (_req, res) => {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

  const staticDir = deps.staticDir ?? path.resolve('dist')
  app.use('/assets', express.static(path.join(staticDir, 'assets'), { maxAge: '1y', immutable: true, dotfiles: 'deny' }))
  app.use(express.static(staticDir, { dotfiles: 'deny', maxAge: 0, setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }))
  // This portfolio has one page. Unknown paths must not silently return its HTML.
  app.use((_req, res) => res.status(404).type('text').send('Page not found. Return to /'))
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (res.headersSent) return
    const status = err?.type === 'entity.too.large' ? 413 : err?.type === 'entity.parse.failed' ? 400 : 503
    audit({ event: status === 503 ? 'request_unavailable' : 'invalid_request', requestId: res.locals.requestId ?? 'unassigned' })
    res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid JSON.' : 'Service temporarily unavailable. Please email me directly.' })
  }
  app.use(errors)
  return app
}
