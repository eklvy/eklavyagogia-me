# Portfolio backend

This project now serves the portfolio and `/api/contact` from one Node.js application. It replaces the browser-to-Formspree submission path. There are no user accounts or public administrative endpoints. Message contents are sent as plain text to the configured owner address, not stored in an application database.

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
- Server-side credentials only. `/api/contact/config` returns just enabled status and the public Turnstile site key. There are no `VITE_` secrets.

## Run locally

1. Use Node 24 LTS and pnpm. Install with `pnpm install --frozen-lockfile --ignore-scripts`.
2. Copy `.env.example` to `.env`. Leave `CONTACT_ENABLED=false` for an immediate local preview without external services.
3. Run `pnpm run build`, then `pnpm start`. Open `http://localhost:3000`. The email-draft fallback remains available while contact delivery is disabled.
4. For frontend hot reload, keep the backend running and run `pnpm dev` separately. Set `APP_ORIGIN=http://localhost:8443` for the browser-facing Vite origin; its `/api` requests are proxied to the backend. Use `pnpm run build:server` and restart the backend after server changes.

`pnpm run typecheck` checks both client and server. `pnpm test` runs validation, security, provider-failure, and rate-limiting tests without sending external emails. The real Redis integration test needs `redis-server` locally and starts an isolated Unix-socket instance; otherwise it is explicitly skipped.

## Enable real contact delivery

1. Create a Cloudflare Turnstile widget restricted to `eklavyagogia.me`. Put its public key in `TURNSTILE_SITE_KEY` and its secret in `TURNSTILE_SECRET_KEY`. Use separate official test keys for local testing; production explicitly rejects those test keys.
2. Create a Resend account and verify a sending subdomain such as `contact.eklavyagogia.me`. Configure only Resend's supplied DNS records for that subdomain. Preserve the existing Namecheap apex MX/SPF records used for forwarding. Do not create a second SPF record at the same hostname.
3. Create a sending-only Resend API key restricted to that verified domain where available. Store it as `RESEND_API_KEY`. Set `CONTACT_FROM` to an address on the verified subdomain and `CONTACT_TO=ext.eklavya@gmail.com`.
4. Connect a private Redis service using `REDIS_URL`. Use a strong password; use `rediss://` for a connection across a public network. Generate `RATE_LIMIT_SECRET` with `openssl rand -hex 32`. Keep it stable across instances and deployments so counters and idempotency keys remain consistent.
5. Set `CONTACT_ENABLED=true`, `NODE_ENV=production`, and `APP_ORIGIN=https://eklavyagogia.me`. Restart the backend. Missing required settings prevent enabled startup. Redis startup failures also prevent startup.
6. Configure the host's actual proxy IPs/CIDRs in `TRUST_PROXY_CIDRS`, and restrict direct access to the app server. Do not guess a forwarded-header trust rule. If the hosting platform cannot supply trustworthy proxy/IP handling, keep contact disabled until its adapter is configured. With proxy trust disabled, a reverse proxy's requests share an IP budget; this is conservative but may block legitimate visitors.

Keep secrets in the hosting provider's secret/environment settings, never in frontend code, Git, screenshots, or chat. No services or accounts have been provisioned by this code change.

## Deploy

Use a host supporting a persistent Node application/container plus Redis. Figma static publishing, GitHub Pages, and uploading only `dist` cannot run this backend. Configure a single public origin for frontend and API.

- Install: `pnpm install --frozen-lockfile --ignore-scripts`
- Build: `pnpm run build`
- Start: `node build/server/index.js`
- Port: platform `PORT`, with `HOST=0.0.0.0` where required.
- Health check: `/api/health`
- Enable HTTPS at the host or reverse proxy. Redirect HTTP to HTTPS and `www` to the apex before traffic reaches the app. The application intentionally does not trust arbitrary host or forwarded-protocol headers to construct redirects.

A non-root, multi-stage `Dockerfile` is included. `compose.yaml` is a local/private deployment starting point with password-protected, persistent Redis, no public Redis port, and the app bound to host loopback. To try it, copy `.env.example`, set a random hex `REDIS_PASSWORD`, and run `docker compose up --build`. It does not include public TLS or DNS configuration; add those through the chosen host/reverse proxy before launch.

Only the `dist` folder is exposed by the server. Unknown paths return 404; `/api` paths never fall back to HTML. Public metadata is already set to the intended domain.

## Launch checks still requiring real services

- Configure the actual production host, its trusted proxy boundary, HTTPS and domain routing. No DNS changes are needed until that host is chosen.
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
