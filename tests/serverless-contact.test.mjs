import { test } from "node:test"
import assert from "node:assert/strict"
import { readConfig } from "../build/server/config.js"
import {
  createServerlessContactHandler,
  vercelClientIp,
} from "../build/server/serverless-contact.js"

const environment = {
  NODE_ENV: "test",
  APP_ORIGIN: "https://www.eklavyagogia.me",
  CONTACT_ENABLED: "true",
  REDIS_URL: "redis://:test-password@127.0.0.1:6379",
  RATE_LIMIT_SECRET: "test-only-not-a-real-secret-".repeat(2),
  TURNSTILE_SITE_KEY: "test-site-key",
  TURNSTILE_SECRET_KEY: "test-secret-key",
  RESEND_API_KEY: "test-email-key",
  CONTACT_FROM: "portfolio@contact.eklavyagogia.me",
}
const config = readConfig(environment)
const fields = {
  name: "Visitor Name",
  email: "visitor@example.com",
  subject: "Research question",
  message: "Hello, I would like to discuss your research.",
  website: "",
  token: "test-token",
}

function fixture(options = {}) {
  const calls = []
  const events = []
  const counts = new Map()
  const handler = createServerlessContactHandler(options.config ?? config, {
    clientIp: options.clientIp ?? (() => "203.0.113.10"),
    limit:
      options.limit ??
      (async (namespace, key, maximum) => {
        const compound = `${namespace}:${key}`
        const count = (counts.get(compound) ?? 0) + 1
        counts.set(compound, count)
        return { allowed: count <= maximum, retryAfterSeconds: 60 }
      }),
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init, body: JSON.parse(init.body) })
      if (String(url).includes("siteverify")) {
        return Response.json(
          options.verification ?? {
            success: true,
            hostname: config.hostname,
            action: "contact",
          },
        )
      }
      return Response.json(options.delivery ?? { id: "accepted-test-id" }, {
        status: options.deliveryStatus ?? 200,
      })
    },
    audit: (event) => events.push(event),
  })
  return { handler, calls, events }
}

function submit(handler, body = fields, headers = {}) {
  return handler(
    new Request("https://www.eklavyagogia.me/api/contact", {
      method: "POST",
      headers: {
        Origin: config.origin,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  )
}

test("GET publishes only contact availability and the public Turnstile key", async () => {
  const { handler } = fixture()
  const response = await handler(
    new Request("https://www.eklavyagogia.me/api/contact"),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    enabled: true,
    siteKey: "test-site-key",
  })
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("x-frame-options"), "DENY")
  assert.ok(response.headers.get("x-request-id"))
})

test("valid submission verifies the challenge and sends the message", async () => {
  const { handler, calls, events } = fixture()
  const response = await submit(handler)
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].body.remoteip, "203.0.113.10")
  assert.deepEqual(calls[1].body.to, ["ext.eklavya@gmail.com"])
  assert.equal(calls[1].body.reply_to, fields.email)
  assert.equal(events[0].event, "message_accepted")
})

test("origin, content type, invalid fields, and oversized bodies fail before email delivery", async () => {
  const badOrigin = fixture()
  assert.equal(
    (
      await submit(badOrigin.handler, fields, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  )
  assert.equal(badOrigin.calls.length, 0)

  const badType = fixture()
  const formRequest = new Request("https://www.eklavyagogia.me/api/contact", {
    method: "POST",
    headers: { Origin: config.origin, "Content-Type": "text/plain" },
    body: "{}",
  })
  assert.equal((await badType.handler(formRequest)).status, 415)

  const invalid = fixture()
  assert.equal(
    (await submit(invalid.handler, { ...fields, website: "spam" })).status,
    400,
  )
  assert.equal(invalid.calls.length, 0)

  const oversized = fixture()
  assert.equal(
    (
      await submit(oversized.handler, {
        ...fields,
        message: "x".repeat(40_000),
      })
    ).status,
    413,
  )
  assert.equal(oversized.calls.length, 0)
})

test("rate-limit storage errors fail closed and throttling returns Retry-After", async () => {
  const unavailable = fixture({
    limit: async () => {
      throw new Error("private store error")
    },
  })
  const unavailableResponse = await submit(unavailable.handler)
  assert.equal(unavailableResponse.status, 503)
  assert.equal(unavailable.events[0].event, "rate_limit_unavailable")
  assert.ok(!(await unavailableResponse.text()).includes("private store error"))

  const blocked = fixture({
    limit: async () => ({ allowed: false, retryAfterSeconds: 90 }),
  })
  const blockedResponse = await submit(blocked.handler)
  assert.equal(blockedResponse.status, 429)
  assert.equal(blockedResponse.headers.get("retry-after"), "90")
  assert.equal(blocked.calls.length, 0)
})

test("provider failures never report success and preserve private errors", async () => {
  const failed = fixture({ deliveryStatus: 500 })
  const response = await submit(failed.handler)
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), {
    error:
      "Your message could not be confirmed. Please try again or email me directly.",
  })
  assert.equal(failed.events[0].event, "delivery_unavailable")
})

test("Vercel IP extraction accepts one valid platform header and rejects malformed values", () => {
  assert.equal(
    vercelClientIp(
      new Request("https://example.test", {
        headers: { "x-vercel-forwarded-for": "203.0.113.9" },
      }),
    ),
    "203.0.113.9",
  )
  assert.equal(
    vercelClientIp(
      new Request("https://example.test", {
        headers: { "x-vercel-forwarded-for": "spoofed" },
      }),
    ),
    "unknown",
  )
  assert.equal(vercelClientIp(new Request("https://example.test")), "unknown")
})
