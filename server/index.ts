import { createClient } from 'redis'
import { RedisStore } from 'rate-limit-redis'
import { createApp } from './app.js'
import { readConfig } from './config.js'

const config = readConfig()
const redis = config.enabled ? createClient({
  url: config.redisUrl,
  disableOfflineQueue: true,
  socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(200 * (retries + 1), 3000) },
}) : null

// Intentionally omit request bodies, addresses, provider responses, and credentials from logs.
redis?.on('error', () => console.error(JSON.stringify({ event: 'redis_unavailable' })))
if (redis) {
  const timeout = setTimeout(() => {
    console.error(JSON.stringify({ event: 'redis_startup_timeout' }))
    process.exit(1)
  }, 10000)
  await redis.connect()
  clearTimeout(timeout)
}
const app = createApp(config, {
  ready: () => !config.enabled || redis?.isReady === true,
  store: redis ? namespace => new RedisStore({
    prefix: `portfolio:contact:${namespace}:`,
    sendCommand: (...args) => redis.withCommandOptions({ timeout: 2500 }).sendCommand(args) as Promise<number | string | (number | string)[]>,
  }) : undefined,
  audit: event => console.info(JSON.stringify(event)),
})
const server = app.listen(config.port, config.host, () => {
  console.info(JSON.stringify({ event: 'listening', port: config.port, contactEnabled: config.enabled }))
})
server.requestTimeout = 15000
server.headersTimeout = 10000
server.keepAliveTimeout = 5000
server.maxRequestsPerSocket = 100

let closing = false
function shutdown() {
  if (closing) return
  closing = true
  const deadline = setTimeout(() => process.exit(1), 10000)
  deadline.unref()
  server.close(async () => {
    if (redis?.isOpen) await redis.close()
    clearTimeout(deadline)
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
