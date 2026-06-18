# Cloudflare setup

This app runs on Cloudflare Pages with D1 for storage and its own email + password
authentication (no Cloudflare Access / IdP required).

## Stack

- Hosting: Cloudflare Pages (static Vite build in `dist/`)
- Auth: email + password, handled by Pages Functions in `functions/api/auth/`
- Sessions: signed HttpOnly cookies (HMAC), secret in `SESSION_SECRET`
- Database: Cloudflare D1 (`users` + `playground_snapshots` tables)

## One-command deploy

From an authenticated terminal (`npx wrangler login` or `CLOUDFLARE_API_TOKEN` set):

```bash
npm run deploy
```

`scripts/deploy-cloudflare.mjs` does everything: creates the D1 database, writes the
binding into `wrangler.toml`, applies `db/schema.sql`, ensures `SESSION_SECRET` exists,
builds, and deploys.

## How auth works

- `POST /api/auth/signup` `{ email, password, name }` - creates a user (PBKDF2-hashed
  password) and sets the session cookie.
- `POST /api/auth/login` `{ email, password }` - verifies and sets the session cookie.
- `POST /api/auth/logout` - clears the cookie.
- `GET /api/session` - returns the signed-in user from the cookie.
- `GET/POST /api/playgrounds` - save/list snapshots; requires a valid session.

Shared logic lives in `worker/auth.js` (imported by the Functions, not itself a route).

## Notes

- `SESSION_SECRET` is a Cloudflare Pages secret. The deploy script generates one on the
  first deploy and leaves it untouched afterwards so existing logins keep working. To
  rotate it (invalidates all sessions):
  `npx wrangler pages secret put SESSION_SECRET --project-name glidescript-playground`
- `npm run dev` (Vite) is for fast UI work only - it does NOT run the Functions, so
  auth is unavailable there and the app shows you as signed out.
- To test auth locally, run `npm run dev:full` (http://localhost:5180). It seeds a local
  D1, builds, and serves the Functions via `wrangler pages dev`. The local DB and
  `.dev.vars` `SESSION_SECRET` are separate from production, so local accounts are local
  only.
- Use the production URL `https://glidescript-playground.pages.dev`, not the per-deploy
  `*.glidescript-playground.pages.dev` alias (its certificate is one subdomain too deep).
