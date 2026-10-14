# Portfolio backend

The production portfolio is a Vite site with a same-origin Vercel Function at `/api/contact`. A separate Express adapter remains available for local or container hosting. There are no user accounts or public administrative endpoints. Message contents are sent as plain text to the configured owner address and are not stored in an application database.

## What is implemented

- Strict server-side field validation, trimming, field length limits, rejection of unknown fields and header control characters, and a 32 KB uncompressed JSON request limit.
- Exact Origin checking for submissions; no permissive CORS. This is a browser protection, not authentication: scripts can forge Origin, so verification and rate limits remain mandatory.
- Mandatory server-side Cloudflare Turnstile verification, checking both hostname and the `contact` action. Client tokens are never trusted without verification.
- Shared Redis limits: 5 attempts per client IP/subnet per 15 minutes, 3 verified attempts per email per hour, and 100 verified attempts globally per hour. IPv6 uses a /56 subnet. Rate-limit keys use HMAC hashing; no raw IP addresses, emails, or messages are stored in Redis. Counters expire. Authentication is required for production Redis, on a private network or with TLS.
- Rate-limit store outages block submissions. Production has no in-memory fallback. Health checks report unavailable Redis.
- Resend delivery uses a fixed, server-configured sender and recipient, with the validated visitor email as Reply-To. The visitor cannot change the recipient. Plain text avoids rendering user HTML.
- Content-derived idempotency keys prevent identical provider retries from producing duplicate emails within Resend's idempotency retention window. Identical messages within that window are intentionally treated as one message. An accepted API response is not proof of inbox delivery.
- Provider timeouts, neutral public errors, request IDs, and logs containing only event names and request IDs. No automatic replies, request-body logging, or provider-error dumps.
- CSP, clickjacking protection, MIME sniffing protection, production HSTS (for this host only), restrictive browser feature permissions, and no-cache API responses.
- Server-side credentials only. `GET /api/contact` returns just enabled status and the public Turnstile site key. There are no `VITE_` secrets.

## Run locally

1. Use Node 24 LTS and pnpm. Install with `pnpm install --frozen-lockfile --ignore-scripts`.
2. Copy `.env.example` to `.env`. Leave `CONTACT_ENABLED=false` for an immediate local preview without external services.
3. Run `pnpm run build`, then `pnpm start`. Open `http://localhost:3000`. The email-draft fallback remains available while contact delivery is disabled.
4. For frontend hot reload, keep the backend running and run `pnpm dev` separately. Set `APP_ORIGIN=http://localhost:8443` for the browser-facing Vite origin; its `/api` requests are proxied to the backend. Use `pnpm run build:server` and restart the backend after server changes.

`pnpm run typecheck` checks both client and server. `pnpm test` runs validation, security, provider-failure, and rate-limiting tests without sending external emails. The real Redis integration test needs `redis-server` locally and starts an isolated Unix-socket instance; otherwise it is explicitly skipped.

## Enable real contact delivery

1. Create a Cloudflare Turnstile widget restricted to `www.eklavyagogia.me`. Put its public key in `TURNSTILE_SITE_KEY` and its secret in `TURNSTILE_SECRET_KEY`. Use separate official test keys for local testing; production explicitly rejects those test keys.
2. Create a Resend account and verify a sending subdomain such as `contact.eklavyagogia.me`. Configure only Resend's supplied DNS records for that subdomain. Preserve the existing Namecheap apex MX/SPF records used for forwarding. Do not create a second SPF record at the same hostname.
3. Create a sending-only Resend API key restricted to that verified domain where available. Store it as `RESEND_API_KEY`. Set `CONTACT_FROM` to an address on the verified subdomain and `CONTACT_TO=ext.eklavya@gmail.com`.
4. Create a password-protected managed Redis database and add its TLS connection URL as `REDIS_URL` (`rediss://...`). Generate `RATE_LIMIT_SECRET` with `openssl rand -hex 32`. Keep it stable so rate-limit and email-idempotency keys remain consistent.
5. In Vercel, add `APP_ORIGIN=https://www.eklavyagogia.me`, `CONTACT_FROM=portfolio@contact.eklavyagogia.me`, `CONTACT_TO=ext.eklavya@gmail.com`, and every key above to Production. Finally set `CONTACT_ENABLED=true` and redeploy. Missing or insecure settings make the function fail closed instead of sending email.
6. Do not add `TRUST_PROXY_CIDRS` on Vercel. The Vercel adapter reads its platform-managed client-IP header and validates it before using a hashed value for rate limiting. `TRUST_PROXY_CIDRS` only applies to the standalone Express server.

Keep secrets in the hosting provider's secret/environment settings, never in frontend code, Git, screenshots, or chat. No services or accounts have been provisioned by this code change.

## Deploy

Vercel is the production host. It builds with `pnpm run build:web`, serves `dist`, and deploys `api/contact.ts` as a Node.js Function. `vercel.json` adds browser security headers and a 30-second function budget. Pushes to `main` trigger deployment through the connected GitHub repository.

The contact function deliberately remains disabled until all required environment variables exist. After changing an environment variable, create a new production deployment because running deployments do not receive later changes.

A non-root, multi-stage `Dockerfile` and the Express server remain available as an alternative persistent deployment. `compose.yaml` starts password-protected Redis without exposing it publicly. That path still uses `/api/health` and the `TRUST_PROXY_CIDRS` rules described in `.env.example`.

Only the `dist` folder is exposed by the server. Unknown paths return 404; `/api` paths never fall back to HTML. Public metadata is already set to the intended domain.

## Launch checks still requiring real services

- Confirm both `eklavyagogia.me` and `www.eklavyagogia.me` resolve through Vercel, with one redirecting to the canonical `www` origin.
- Check a real Turnstile challenge, a manually submitted message, its Resend event and receipt in Gmail, and Reply-To behaviour. No test email is sent automatically.
- Verify live fonts, widget/CSP compatibility, keyboard/mobile behaviour, real browser zoom, and provider failure recovery.
- Enable spending/usage alerts and monitor rate-limit/provider events. Application controls cannot eliminate denial-of-service attacks at the network edge; use the host's edge protections.
- Keep dependencies and base images patched. Redis persistence and backups matter for availability; losing counter data resets budgets.
- Review the provider retention settings for email content and verification data. This app avoids its own message storage, but the email and challenge providers process submissions.

## References

- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Turnstile content security policy](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Express rate-limit options](https://express-rate-limit.mintlify.app/reference/configuration)
- [Redis rate-limit store](https://github.com/express-rate-limit/rate-limit-redis)
