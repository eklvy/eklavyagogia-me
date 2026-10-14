import { createClient } from "redis"
import { readConfig } from "../server/config.js"
import { createServerlessContactHandler } from "../server/serverless-contact.js"

const config = readConfig({
  ...process.env,
  // The current Vercel project redirects the apex domain to this canonical origin.
  APP_ORIGIN: process.env.APP_ORIGIN ?? "https://www.eklavyagogia.me",
})
const redis = config.enabled
  ? createClient({
      url: config.redisUrl,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => Math.min(200 * (retries + 1), 3000),
      },
    })
  : null

redis?.on("error", () =>
  console.error(JSON.stringify({ event: "redis_unavailable" })),
)
let connection: Promise<unknown> | null = null

async function connectedRedis() {
  if (!redis) throw new Error("redis_disabled")
  if (redis.isReady) return redis
  if (!connection) {
    connection = redis.connect().finally(() => {
      connection = null
    })
  }
  await connection
  return redis
}

const rateLimitScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`

const handler = createServerlessContactHandler(config, {
  limit: async (namespace, key, maximum, windowMs) => {
    const client = await connectedRedis()
    const result = (await client.eval(rateLimitScript, {
      keys: [`portfolio:contact:${namespace}:${key}`],
      arguments: [String(windowMs)],
    })) as [number, number]
    const count = Number(result[0])
    const ttl = Math.max(Number(result[1]), 1000)
    return {
      allowed: count <= maximum,
      retryAfterSeconds: Math.ceil(ttl / 1000),
    }
  },
  audit: (event) => console.info(JSON.stringify(event)),
})

export const maxDuration = 30

export default {
  fetch: handler,
}
