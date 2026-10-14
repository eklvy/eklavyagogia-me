import { isIP } from "node:net"
import type { Config } from "./config.js"
import {
  contactSchema,
  privateKey,
  sendContact,
  verifyChallenge,
  type Fetch,
} from "./contact.js"

type LimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

export type ServerlessDependencies = {
  limit: (
    namespace: string,
    key: string,
    maximum: number,
    windowMs: number,
  ) => Promise<LimitResult>
  fetcher?: Fetch
  audit?: (event: { event: string, requestId: string }) => void
  clientIp?: (request: Request) => string
}

const BODY_LIMIT = 32 * 1024

function responseHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-ID": requestId,
  }
}

function json(
  requestId: string,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
) {
  return Response.json(body, {
    status,
    headers: {
      ...responseHeaders(requestId),
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  })
}

async function readBoundedJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > BODY_LIMIT)
    throw new Error("too_large")
  if (!request.body) throw new Error("invalid_json")

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > BODY_LIMIT) {
      await reader.cancel()
      throw new Error("too_large")
    }
    chunks.push(value)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    ) as unknown
  } catch {
    throw new Error("invalid_json")
  }
}

export function vercelClientIp(request: Request) {
  const raw = request.headers.get("x-vercel-forwarded-for") ?? ""
  const candidate = raw.split(",")[0]?.trim() ?? ""
  return isIP(candidate) ? candidate : "unknown"
}

export function createServerlessContactHandler(
  config: Config,
  dependencies: ServerlessDependencies,
) {
  const fetcher = dependencies.fetcher ?? fetch
  const audit = dependencies.audit ?? (() => {})
  const clientIp = dependencies.clientIp ?? vercelClientIp

  return async function handle(request: Request) {
    const requestId = crypto.randomUUID()

    if (request.method === "GET") {
      return json(requestId, {
        enabled: config.enabled,
        siteKey: config.enabled ? config.siteKey : null,
      })
    }
    if (request.method !== "POST") {
      return json(requestId, { error: "Method not allowed." }, 405, {
        Allow: "GET, POST",
      })
    }
    if (!config.enabled) {
      return json(
        requestId,
        {
          error:
            "Contact is temporarily unavailable. Please email me directly.",
        },
        503,
      )
    }
    if (
      request.headers.get("origin") !== config.origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return json(requestId, { error: "Request origin is not allowed." }, 403)
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
    const contentEncoding = request.headers
      .get("content-encoding")
      ?.toLowerCase()
    if (
      !contentType.startsWith("application/json") ||
      (contentEncoding && contentEncoding !== "identity")
    ) {
      return json(
        requestId,
        { error: "Use an uncompressed JSON request." },
        415,
      )
    }

    const ip = clientIp(request)
    try {
      const ipLimit = await dependencies.limit(
        "ip",
        privateKey(config.rateLimitSecret, "ip", ip),
        5,
        15 * 60_000,
      )
      if (!ipLimit.allowed) {
        return json(
          requestId,
          {
            error:
              "Too many attempts. Please try again later or email me directly.",
          },
          429,
          {
            "Retry-After": String(ipLimit.retryAfterSeconds),
          },
        )
      }
    } catch {
      audit({ event: "rate_limit_unavailable", requestId })
      return json(
        requestId,
        {
          error:
            "Contact is temporarily unavailable. Please email me directly.",
        },
        503,
      )
    }

    let rawBody: unknown
    try {
      rawBody = await readBoundedJson(request)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "too_large"
      return json(
        requestId,
        { error: tooLarge ? "Request is too large." : "Invalid JSON." },
        tooLarge ? 413 : 400,
      )
    }
    const parsed = contactSchema.safeParse(rawBody)
    if (!parsed.success || parsed.data.website !== "") {
      return json(
        requestId,
        { error: "Please check the form fields and try again." },
        400,
      )
    }

    try {
      if (
        !(await verifyChallenge(
          config,
          parsed.data.token,
          ip === "unknown" ? "" : ip,
          fetcher,
        ))
      ) {
        return json(
          requestId,
          { error: "Verification expired or failed. Please verify again." },
          400,
        )
      }
    } catch {
      audit({ event: "verification_unavailable", requestId })
      return json(
        requestId,
        {
          error:
            "Verification is unavailable. Please try again or email me directly.",
        },
        503,
      )
    }

    try {
      const [emailLimit, globalLimit] = await Promise.all([
        dependencies.limit(
          "email",
          privateKey(
            config.rateLimitSecret,
            "email",
            parsed.data.email.toLowerCase(),
          ),
          3,
          60 * 60_000,
        ),
        dependencies.limit("global", "all", 100, 60 * 60_000),
      ])
      const blocked = [emailLimit, globalLimit].find(
        (result) => !result.allowed,
      )
      if (blocked) {
        return json(
          requestId,
          {
            error:
              "Too many attempts. Please try again later or email me directly.",
          },
          429,
          {
            "Retry-After": String(blocked.retryAfterSeconds),
          },
        )
      }
    } catch {
      audit({ event: "rate_limit_unavailable", requestId })
      return json(
        requestId,
        {
          error:
            "Contact is temporarily unavailable. Please email me directly.",
        },
        503,
      )
    }

    try {
      await sendContact(config, parsed.data, fetcher)
      audit({ event: "message_accepted", requestId })
      return json(requestId, { ok: true }, 202)
    } catch {
      audit({ event: "delivery_unavailable", requestId })
      return json(
        requestId,
        {
          error:
            "Your message could not be confirmed. Please try again or email me directly.",
        },
        502,
      )
    }
  }
}
