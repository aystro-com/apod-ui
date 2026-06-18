# apod-ui

A secure, easy-to-use web UI for [apod](https://github.com/aystro-com/apod) — the single-binary VPS hosting platform. Built with React, TypeScript, [TanStack Router + Query](https://tanstack.com), and [coss ui](https://coss.com/ui) (Base UI + Tailwind CSS).

## Features

- **Profile & security** — change your password, enable TOTP 2FA (with recovery codes), and mint scoped API tokens
- **First-run setup** — a fresh instance lands on an admin-creation screen
- **Dashboard** — live server stats (CPU, memory, disk) and per-site resource usage
- **Sites** — create, start/stop/restart, clone, transfer, and destroy sites with type-to-confirm guard rails
- **Architecture** — a topology canvas of the site's processes (web / workers / scheduler / backing services); scale workers up and down and restart processes inline
- **Deploys** — trigger git deploys, roll back, view history, and manage push-to-deploy webhooks
- **Domains** — manage domain aliases with automatic SSL
- **Environment** — env vars with masked values and reveal-on-demand
- **Backups** — on-demand and scheduled backups, restore/delete, **provision a new site from a backup** (staging-from-prod), S3/R2/SFTP storage backends
- **Cron** — per-site cron jobs running inside the container
- **Security** — per-site IP access (allow/block with allowlist mode), proxy rules, FTP/SFTP accounts
- **Uptime** — HTTP monitoring with webhook alerts and check history
- **Console** — token-based web terminal scoped to the site's container
- **Logs** — container stdout/stderr and per-site/global activity logs
- **Users** (admin) — multi-tenant user management with one-time API key display
- **System** (admin) — version/self-update, custom drivers (paste + validate/preview YAML), UFW firewall (port rules + source whitelists + numbered rule management), SSH keys, disk usage
- Dark mode, responsive layout, accessible components (Base UI)

## Quick start

```bash
npm install
npm run dev          # local dev on http://localhost:5173
npm test             # run the test suite (Vitest + Testing Library)
npm run build        # production build in dist/
```

Sign in with your apod server URL (e.g. `https://your-server:8443`) and either:

- **Username + password** (recommended for browsers) — set one with
  `apod user passwd <name> --password '...'`. The UI exchanges it for a
  24-hour session token; no long-lived secret is kept in the browser.
- **API key** — from `apod user create <name>` / `apod user reset-key <name>`.
  Works with any apod version.

## Deployment

The build output in `dist/` is a static SPA. **The recommended setup is serving it from the same origin as the apod API** behind a reverse proxy — this avoids CORS entirely (the apod daemon does not emit CORS headers) and lets you leave the "Server URL" field empty at login.

### Example: Caddy

```caddy
panel.example.com {
    # apod REST API
    reverse_proxy /api/* https://127.0.0.1:8443
    reverse_proxy /webhook/* https://127.0.0.1:8443

    # the UI
    root * /var/www/apod-ui/dist
    try_files {path} /index.html
    file_server
}
```

### Example: nginx

```nginx
server {
    listen 443 ssl;
    server_name panel.example.com;

    location /api/ {
        proxy_pass https://127.0.0.1:8443;
        proxy_set_header Host $host;
    }
    location /webhook/ {
        proxy_pass https://127.0.0.1:8443;
    }
    location / {
        root /var/www/apod-ui/dist;
        try_files $uri /index.html;
    }
}
```

### Direct remote access

You can also point the UI at a remote apod server from the login screen, but the apod daemon must then be fronted by a proxy that adds CORS headers for your UI's origin. Same-origin deployment is simpler and safer.

### Local development against a real server

```bash
APOD_PROXY_TARGET=https://your-server:8443 npm run dev
```

This proxies `/api` through the Vite dev server (no CORS issues). Leave the Server URL empty at login.

## Security

- **Two-factor authentication** — TOTP (any authenticator app) with single-use recovery codes; the login screen prompts for the second factor only after the password is accepted.
- **Scoped API tokens** — create `read`/`write`/`deploy` tokens with an optional sensitive-data flag for CI and automation, shown once and revocable; scoped tokens can never manage users, passwords, 2FA, or other tokens.
- **First-run setup** — a fresh server (no users) is detected via `/setup/status` and routed to a one-time admin-creation screen instead of an unusable login.
- **Password login** exchanges credentials for a 24-hour server-side session token (`apod_sess_…`) — the password itself is never stored, and "Disconnect" revokes the session server-side.
- **API keys / session tokens** are stored in `sessionStorage` by default (cleared when the tab closes). "Remember on this device" opts into `localStorage`. Credentials are sent only as `Authorization: Bearer` headers — never in URLs.
- **Automatic sign-out** on `401` (revoked key or expired session).
- **Strict CSP** is injected into production builds (`script-src 'self'`, `frame-ancestors 'none'`, etc.), plus `Referrer-Policy: no-referrer`.
- **Destructive actions** (destroy site, restore backup, delete user, …) require explicit confirmation; the most dangerous ones require typing the resource name.
- **Secrets are masked** in the UI (env values, DB credentials, FTP passwords) with reveal-on-demand; freshly created API keys are shown exactly once.
- **Client-side validation** mirrors the server's (domains, IPs, ports, env keys) to fail fast — the server remains the source of truth.
- **Rate-limit aware**: polling intervals are tuned to stay well under apod's 60 req/min limit, and `429` responses surface a friendly message.

## Development

The project is test-driven: every page and library module has a colocated `*.test.ts(x)` spec.

```bash
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage
npm run lint             # eslint
```

### Project layout

```
src/
  router.tsx   TanStack Router route tree
  lib/         api client, auth context, formatting, mutation helper
  components/  app shell + shared widgets (confirm dialog, status badge, …)
    ui/        vendored coss ui components (Base UI + Tailwind)
  pages/       one file per route; site tabs under pages/site/
  test/        shared test harness (fetch mocking, render helpers)
```

UI components come from [coss ui](https://coss.com/ui) via the shadcn CLI:

```bash
npx shadcn@latest add @coss/<component>
```

## License

MIT
