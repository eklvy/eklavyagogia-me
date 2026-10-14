# Eklavya Gogia — Portfolio

Source for [eklavyagogia.me](https://eklavyagogia.me), built with React, TypeScript,
Vite, and Tailwind CSS.

## Local preview

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
PORT=3001 APP_ORIGIN=http://localhost:3001 CONTACT_ENABLED=false pnpm start
```

Open `http://localhost:3001`.

## Deployment

Pushes to `main` build the frontend and deploy `dist/` through GitHub Pages. The
custom domain is preserved through `public/CNAME`.

GitHub Pages is static hosting, so it does not run the Express contact backend.
Until a Node-compatible production host and its required secrets are configured,
the contact form uses the email-draft fallback. See [BACKEND.md](BACKEND.md) for the
server setup and security requirements.
