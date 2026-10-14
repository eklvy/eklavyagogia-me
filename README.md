# Eklavya Gogia — Portfolio

Source for [eklavyagogia.me](https://eklavyagogia.me), built with React, TypeScript,
Vite, Tailwind CSS, and a Vercel Function for secure contact delivery.

## Local preview

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
PORT=3001 APP_ORIGIN=http://localhost:3001 CONTACT_ENABLED=false pnpm start
```

Open `http://localhost:3001`.

## Deployment

Vercel deploys every push to `main`. It serves the Vite production build and the
`/api/contact` function from the same origin. GitHub Pages deployment is disabled
so only one production host controls the custom domain.

The form keeps its email-draft fallback until every required production setting is
present and `CONTACT_ENABLED=true`. See [BACKEND.md](BACKEND.md) for the exact
settings and launch checks.
