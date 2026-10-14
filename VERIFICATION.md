# Backend verification — 13 October 2026

## Completed locally

- Frontend and backend production compilation; TypeScript checks for both.
- 15 automated backend tests, including a real isolated Redis instance. The suite checks field/header injection, unsupported body types and sizes, origin enforcement, CAPTCHA hostname/action checks, provider outages, idempotency, forged forwarding headers, per-IP/email/global budgets, sharing counters between app instances, Redis outage handling, and public security headers.
- Production dependency audit: no reported advisories among the 79 production dependencies at the time of this check. This is a point-in-time package advisory check, not a guarantee against unknown vulnerabilities.
- Headless Chrome with the actual built frontend and backend. Turnstile and email-provider responses were mocked; no real email was sent. Verified error text and field preservation, successful acceptance, rapid duplicate submission protection, clearing fields after success, disabled-backend email fallback, and no browser page exceptions.
- No horizontal overflow at 1440, 768, 390, and 320 CSS pixels with the test widget. Mobile contact form screenshot inspected.
- Docker Compose configuration parsed successfully. The Docker daemon was unavailable, so the container image itself was not built or run.
- No server-secret environment variable names or old Formspree configuration references found in the client source/build.

## Not claimed as verified

- Real Turnstile widget rendering and challenge completion on the production domain.
- Resend domain verification, actual email acceptance/delivery, and Reply-To in Gmail.
- Production Redis credentials, TLS, persistence, and chosen host's proxy boundary.
- Public HTTPS, domain routing, deployment, edge abuse protections, and network-level load capacity.
- Docker runtime and a manual assistive-technology session.

The default configuration keeps direct submission disabled and preserves the email-draft option. Complete the service configuration and launch checks in BACKEND.md before enabling it publicly.
