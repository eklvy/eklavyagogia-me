import { z } from 'zod'
import { isIP } from 'node:net'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:3000'),
  CONTACT_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_SECRET: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CONTACT_FROM: z.string().optional(),
  CONTACT_TO: z.email().default('ext.eklavya@gmail.com'),
  TRUST_PROXY_CIDRS: z.string().default(''),
})

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) throw new Error('Invalid server environment configuration')
  const e = parsed.data
  const origin = new URL(e.APP_ORIGIN)
  if (origin.origin !== e.APP_ORIGIN || origin.username || origin.password) {
    throw new Error('APP_ORIGIN must be an exact origin without a path or trailing slash')
  }
  if (e.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('Production APP_ORIGIN must use HTTPS')
  }
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Invalid origin protocol')
  const trustProxy = e.TRUST_PROXY_CIDRS.split(',').map(x => x.trim()).filter(Boolean)
  for (const entry of trustProxy) {
    const [ip, mask, extra] = entry.split('/')
    const family = isIP(ip)
    if (!family || extra || (mask !== undefined && (!/^\d+$/.test(mask) || Number(mask) < 1 || Number(mask) > (family === 4 ? 32 : 128)))) {
      throw new Error('TRUST_PROXY_CIDRS must contain explicit proxy IPs or non-global CIDRs')
    }
  }
  const enabled = e.CONTACT_ENABLED === 'true'
  if (enabled) {
    if (!e.REDIS_URL || !/^rediss?:\/\//.test(e.REDIS_URL)) throw new Error('A Redis connection is required')
    let redisUrl: URL
    try { redisUrl = new URL(e.REDIS_URL) } catch { throw new Error('Invalid Redis connection URL') }
    if (e.NODE_ENV === 'production' && !redisUrl.password) throw new Error('Production Redis must require authentication')
    if (!e.RATE_LIMIT_SECRET || e.RATE_LIMIT_SECRET.length < 32) throw new Error('A random RATE_LIMIT_SECRET of at least 32 characters is required')
    if (!e.TURNSTILE_SITE_KEY || !e.TURNSTILE_SECRET_KEY || !e.RESEND_API_KEY) throw new Error('Bot verification and email credentials are required')
    if (!e.CONTACT_FROM || !z.email().safeParse(e.CONTACT_FROM).success) throw new Error('CONTACT_FROM must be a verified sender email address')
    if (e.NODE_ENV === 'production' && /^[123]x0+/.test(e.TURNSTILE_SECRET_KEY)) throw new Error('Turnstile test keys are forbidden in production')
    if (e.NODE_ENV === 'production' && /^[123]x0+/.test(e.TURNSTILE_SITE_KEY)) throw new Error('Turnstile test site keys are forbidden in production')
  }
  return {
    environment: e.NODE_ENV, port: e.PORT, host: e.HOST,
    origin: origin.origin, hostname: origin.hostname, trustProxy, enabled,
    redisUrl: e.REDIS_URL ?? '', rateLimitSecret: e.RATE_LIMIT_SECRET ?? '',
    siteKey: e.TURNSTILE_SITE_KEY ?? '', turnstileSecret: e.TURNSTILE_SECRET_KEY ?? '',
    resendKey: e.RESEND_API_KEY ?? '', from: e.CONTACT_FROM ?? '', to: e.CONTACT_TO,
  }
}

export type Config = ReturnType<typeof readConfig>
