import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from 'redis'
import { RedisStore } from 'rate-limit-redis'
import request from 'supertest'
import { createApp } from '../build/server/app.js'
import { readConfig } from '../build/server/config.js'

test('real Redis shares counters across app instances, stores hashed keys, and fails closed on outage', async t => {
  if (spawnSync('redis-server', ['--version']).status !== 0) {
    t.skip('redis-server is required for the persistence integration test')
    return
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'portfolio-redis-'))
  const socket = path.join(directory, 'redis.sock')
  const process = spawn('redis-server', ['--port', '0', '--unixsocket', socket, '--unixsocketperm', '700', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' })
  const client = createClient({ socket: { path: socket, connectTimeout: 2000, reconnectStrategy: 20 }, disableOfflineQueue: true })
  client.on('error', () => {})
  const timeout = setTimeout(() => client.destroy(), 5000)
  try {
    await client.connect()
    clearTimeout(timeout)
    const config = readConfig({ NODE_ENV: 'test', APP_ORIGIN: 'https://eklavyagogia.me', CONTACT_ENABLED: 'true',
      REDIS_URL: 'redis://localhost', RATE_LIMIT_SECRET: 'test-only-secret-'.repeat(4), TURNSTILE_SITE_KEY: 'test-site',
      TURNSTILE_SECRET_KEY: 'test-secret', RESEND_API_KEY: 'test-key', CONTACT_FROM: 'portfolio@eklavyagogia.me' })
    let sent = 0
    const deps = {
      store: namespace => new RedisStore({ prefix: `integration:${namespace}:`, sendCommand: (...args) => client.withCommandOptions({ timeout: 500 }).sendCommand(args) }),
      fetcher: async url => {
        if (url.includes('siteverify')) return Response.json({ success: true, hostname: config.hostname, action: 'contact' })
        sent++
        return Response.json({ id: 'test-id' })
      },
    }
    const first = createApp(config, deps)
    const second = createApp(config, deps)
    const submit = app => request(app).post('/api/contact').set('Origin', config.origin).send({
      name: 'Example Visitor', email: 'visitor@example.com', message: 'A meaningful test message.', token: 'mock-token', website: '', subject: '',
    })
    assert.equal((await submit(first)).status, 202)
    assert.equal((await submit(second)).status, 202)
    assert.equal((await submit(first)).status, 202)
    assert.equal((await submit(second)).status, 429)
    const keys = await client.keys('integration:*')
    assert.ok(keys.some(key => /^integration:ip:[a-f0-9]{64}$/.test(key)))
    assert.ok(keys.some(key => /^integration:email:[a-f0-9]{64}$/.test(key)))
    for (const key of keys) {
      assert.ok(!key.includes('visitor@example.com'))
      assert.ok(await client.pTTL(key) > 0)
    }
    assert.equal(sent, 3)
    client.destroy()
    assert.equal((await submit(first)).status, 503)
    assert.equal(sent, 3)
  } finally {
    clearTimeout(timeout)
    if (client.isOpen) client.destroy()
    if (process.exitCode === null && process.signalCode === null) {
      const exited = new Promise(resolve => process.once('exit', resolve))
      process.kill('SIGTERM')
      await exited
    }
    await rm(directory, { recursive: true, force: true })
  }
})
