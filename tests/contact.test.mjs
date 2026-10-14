import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { MemoryStore } from 'express-rate-limit'
import { createApp } from '../build/server/app.js'
import { readConfig } from '../build/server/config.js'

const environment = {
  NODE_ENV: 'test', APP_ORIGIN: 'https://eklavyagogia.me', CONTACT_ENABLED: 'true',
  REDIS_URL: 'redis://:test-password@127.0.0.1:6379', RATE_LIMIT_SECRET: 'test-only-not-a-real-secret-'.repeat(2),
  TURNSTILE_SITE_KEY: 'test-site-key', TURNSTILE_SECRET_KEY: 'test-secret-key',
  RESEND_API_KEY: 'test-email-key', CONTACT_FROM: 'portfolio@eklavyagogia.me',
}
const config = readConfig(environment)
const fields = { name: 'Visitor Name', email: 'visitor@example.com', subject: 'A research question', message: 'Hello, I would like to discuss your research.', website: '', token: 'test-token' }

function fixture(options = {}) {
  const calls = []
  const events = []
  const app = createApp(options.config ?? config, {
    store: () => new MemoryStore(), // Only tests use this. Production requires Redis.
    ...options.dependencies,
    fetcher: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) })
      if (String(url).includes('siteverify')) {
        if (options.verificationThrows) throw new Error('secret provider error')
        return Response.json(options.verification ?? { success: true, hostname: config.hostname, action: 'contact' }, { status: options.verificationStatus ?? 200 })
      }
      return Response.json(options.delivery ?? { id: 'accepted-test-id' }, { status: options.deliveryStatus ?? 200 })
    },
    audit: event => events.push(event),
  })
  return { app, calls, events }
}
function submit(app, body = fields) {
  return request(app).post('/api/contact').set('Origin', config.origin).send(body)
}

test('valid input is verified and accepted; server fixes recipient and preserves Unicode as plain text', async () => {
  const { app, calls, events } = fixture()
  const message = 'नमस्ते 中文 مرحبا café\n<script>alert("x")</script> & more'
  const response = await submit(app, { ...fields, message })
  assert.equal(response.status, 202)
  assert.deepEqual(response.body, { ok: true })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].body.secret, config.turnstileSecret)
  const mail = calls[1].body
  assert.deepEqual(mail.to, ['ext.eklavya@gmail.com'])
  assert.equal(mail.reply_to, fields.email)
  assert.equal(mail.from, config.from)
  assert.equal(mail.html, undefined)
  assert.ok(mail.text.endsWith(message))
  assert.match(calls[1].init.headers['Idempotency-Key'], /^contact\/[a-f0-9]{64}$/)
  assert.equal(events[0].event, 'message_accepted')
  assert.ok(!JSON.stringify(events).includes(fields.email))
  assert.ok(!JSON.stringify(events).includes(message))
})

test('origin checking rejects absent, malicious, null and cross-site origins before provider calls', async () => {
  for (const origin of [undefined, 'null', 'https://evil.example', 'https://eklavyagogia.me.evil.example']) {
    const { app, calls } = fixture()
    let req = request(app).post('/api/contact')
    if (origin) req = req.set('Origin', origin)
    assert.equal((await req.send(fields)).status, 403)
    assert.equal(calls.length, 0)
  }
  const { app, calls } = fixture()
  assert.equal((await submit(app).set('Sec-Fetch-Site', 'cross-site')).status, 403)
  assert.equal(calls.length, 0)
})

test('only bounded uncompressed JSON is accepted', async () => {
  const { app, calls } = fixture()
  assert.equal((await request(app).post('/api/contact').set('Origin', config.origin).type('form').send(fields)).status, 415)
  assert.equal((await submit(app).set('Content-Encoding', 'gzip')).status, 415)
  assert.equal((await request(app).post('/api/contact').set('Origin', config.origin).type('json').send('{invalid')).status, 400)
  assert.equal((await submit(app, { ...fields, message: 'x'.repeat(40000) })).status, 413)
  assert.equal(calls.length, 0)
})

test('server rejects invalid fields, whitespace, injection and unrecognised recipient overrides', async () => {
  for (const patch of [
    { name: '  ' }, { name: 'a'.repeat(101) }, { email: 'not-an-email' },
    { message: ' \n\t ' }, { message: 'x'.repeat(5001) }, { token: '' },
    { token: 'x'.repeat(2049) }, { website: 'https://spam.example' },
    { subject: 'Hi\r\nBcc: victim@example.com' }, { name: 'Name\u0000' },
    { subject: 'x'.repeat(161) }, { to: 'victim@example.com' }, { html: '<img src=x>' },
  ]) {
    const { app, calls } = fixture()
    assert.equal((await submit(app, { ...fields, ...patch })).status, 400, JSON.stringify(patch))
    assert.equal(calls.length, 0)
  }
})

test('challenge success requires the correct action and exact hostname', async () => {
  for (const verification of [
    { success: false }, { success: 'true', hostname: config.hostname, action: 'contact' },
    { success: true, hostname: 'evil.example', action: 'contact' },
    { success: true, hostname: config.hostname, action: 'login' },
  ]) {
    const { app, calls } = fixture({ verification })
    assert.equal((await submit(app)).status, 400)
    assert.equal(calls.length, 1)
  }
})

test('verification outages fail closed without disclosing internal errors', async () => {
  for (const options of [{ verificationThrows: true }, { verificationStatus: 503 }]) {
    const { app, calls } = fixture(options)
    const response = await submit(app)
    assert.equal(response.status, 503)
    assert.equal(calls.length, 1)
    assert.ok(!response.text.includes('secret'))
  }
})

test('email failure or unconfirmed response never reports success', async () => {
  for (const options of [{ deliveryStatus: 500 }, { delivery: {} }]) {
    const { app } = fixture(options)
    assert.equal((await submit(app)).status, 502)
  }
})

test('repeat content uses the same delivery idempotency key; changed content uses another', async () => {
  const { app, calls } = fixture()
  await submit(app)
  await submit(app, { ...fields, token: 'new-token' })
  await submit(app, { ...fields, message: 'This is a different valid message.' })
  const keys = calls.filter(call => call.url.includes('resend')).map(call => call.init.headers['Idempotency-Key'])
  assert.equal(keys[0], keys[1])
  assert.notEqual(keys[0], keys[2])
})

test('IP throttling cannot be bypassed with untrusted X-Forwarded-For headers', async () => {
  const { app, calls } = fixture({ verification: { success: false } })
  for (let index = 0; index < 5; index++) {
    assert.equal((await submit(app).set('X-Forwarded-For', `203.0.113.${index + 1}`)).status, 400)
  }
  const response = await submit(app).set('X-Forwarded-For', '203.0.113.99')
  assert.equal(response.status, 429)
  assert.ok(response.headers['retry-after'])
  assert.equal(calls.length, 5)
})

test('per-address hourly limit is enforced separately from the IP limit', async () => {
  const { app, calls } = fixture()
  for (let index = 0; index < 3; index++) assert.equal((await submit(app)).status, 202)
  assert.equal((await submit(app)).status, 429)
  assert.equal(calls.filter(call => call.url.includes('resend')).length, 3)
})

test('the global budget caps distributed verified submissions across distinct addresses', async () => {
  const { app, calls } = fixture({ config: { ...config, trustProxy: ['127.0.0.1/32', '::1/128'] } })
  for (let index = 1; index <= 100; index++) {
    const response = await submit(app, { ...fields, email: `visitor${index}@example.com` })
      .set('X-Forwarded-For', `203.0.113.${index}`)
    assert.equal(response.status, 202)
  }
  assert.equal((await submit(app, { ...fields, email: 'another@example.com' })
    .set('X-Forwarded-For', '203.0.113.101')).status, 429)
  assert.equal(calls.filter(call => call.url.includes('resend')).length, 100)
})

test('disabled or unhealthy backend sends no email and exposes no secrets in configuration', async () => {
  const disabled = fixture({ config: readConfig({ NODE_ENV: 'test' }) })
  assert.equal((await submit(disabled.app)).status, 503)
  assert.deepEqual((await request(disabled.app).get('/api/contact/config')).body, { enabled: false, siteKey: null })
  const live = fixture({ dependencies: { ready: () => false } })
  assert.equal((await submit(live.app)).status, 503)
  assert.equal((await request(live.app).get('/api/health')).status, 503)
  const publicConfig = await request(live.app).get('/api/contact/config')
  assert.deepEqual(publicConfig.body, { enabled: true, siteKey: config.siteKey })
  assert.equal(live.calls.length, 0)
})

test('unknown API routes and methods do not fall through to the frontend; response headers are restrictive', async () => {
  const { app } = fixture()
  const response = await request(app).get('/api/contact')
  assert.equal(response.status, 405)
  assert.equal(response.headers.allow, 'POST')
  assert.equal(response.headers['x-powered-by'], undefined)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/)
  assert.equal((await request(app).get('/api/no-such-route')).status, 404)
  assert.equal((await request(app).get('/.env')).status, 404)
  assert.equal((await request(app).get('/server/config.ts')).status, 404)
})

test('configuration refuses insecure production settings and broad proxy trust', () => {
  assert.throws(() => readConfig({ ...environment, NODE_ENV: 'production', APP_ORIGIN: 'http://eklavyagogia.me' }))
  assert.throws(() => readConfig({ ...environment, TRUST_PROXY_CIDRS: 'true' }))
  assert.throws(() => readConfig({ ...environment, TRUST_PROXY_CIDRS: '0.0.0.0/0' }))
  assert.throws(() => readConfig({ ...environment, RATE_LIMIT_SECRET: 'short' }))
  assert.throws(() => readConfig({ ...environment, RESEND_API_KEY: '' }))
  assert.throws(() => readConfig({ ...environment, NODE_ENV: 'production', REDIS_URL: 'redis://127.0.0.1:6379' }))
  assert.throws(() => readConfig({ ...environment, APP_ORIGIN: 'https://eklavyagogia.me/path' }))
  assert.throws(() => readConfig({ ...environment, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' }))
  assert.throws(() => createApp(config))
})
