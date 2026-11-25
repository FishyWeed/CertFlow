# CertFlow

CertFlow is an interactive certificate designer, bulk generator and email distributor. It runs on SvelteKit 3, Svelte 5, PostgreSQL (Drizzle ORM), Better Auth, Konva and Vercel UI SDK.

## Local Setup (No Docker Required)

Local development uses embedded PostgreSQL (`PGlite` in `./.local/pgdata`) and a local email outbox (`./.local/outbox/`). You do not need Docker or external accounts to run the app.

1. Install the packages:
   ```bash
   pnpm install
   ```
2. If `.env` does not exist, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Push the PostgreSQL schema:
   ```bash
   pnpm db:push
   ```
4. Start the local development server:
   ```bash
   pnpm dev
   ```
5. Open `http://localhost:5678` in your browser.

## Optional: Local Docker Postgres and Mailpit

If you prefer a separate PostgreSQL container and Mailpit inbox (`http://localhost:8025`), follow these steps:

1. Start the containers:
   ```bash
   docker compose up -d
   ```
2. Set `DATABASE_URL="postgresql://certflow:certflow_dev_password@localhost:5432/certflow"` and `SMTP_HOST="localhost"` in `.env`.
3. Push the schema:
   ```bash
   pnpm db:push
   ```

## Common Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Start the local SvelteKit development server |
| `pnpm db:push` | Synchronise the Drizzle schema to PostgreSQL (`PGlite` or remote Postgres) |
| `pnpm db:studio` | Open the Drizzle visual database browser |
| `pnpm test` | Run Vitest unit tests |
| `pnpm check` | Run `svelte-kit sync` and `svelte-check` |
| `pnpm build` | Build production Node server bundle |
| `pnpm start` | Run the built production server (`build/index.js`) |

## Deployment (Railway)

CertFlow includes `@sveltejs/adapter-node`, a `/api/health` endpoint and automatic PostgreSQL migrations on startup (`scripts/start.mjs` + `drizzle/`).

1. Push the repository to GitHub (`.env`, `.local/`, `uploads/`, `.tmp/` and `.ctx/` are ignored).
2. Create a new Railway project from your GitHub repository.
3. Add a **PostgreSQL** service in the same Railway project.
4. Attach a persistent **Volume** to the CertFlow service mounted at `/data/uploads`.
5. Set these environment variables on the CertFlow service:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `BETTER_AUTH_URL` and `PUBLIC_APP_URL`: your Railway HTTPS URL (for example `https://${{RAILWAY_PUBLIC_DOMAIN}}`)
   - `BETTER_AUTH_SECRET`: a fresh random 64-character hex secret
   - `ENCRYPTION_KEY`: a fresh random 64-character hex secret (keep this fixed after saving SMTP profiles)
   - `STORAGE_DRIVER`: `local`
   - `LOCAL_UPLOAD_DIR`: `/data/uploads`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `DEFAULT_FROM_NAME`, `DEFAULT_FROM_EMAIL`: optional server-wide SMTP credentials (or leave unset and use per-account SMTP profiles in **Account Settings**)
6. Optionally set **Healthcheck Path** to `/api/health` in Railway service **Settings** -> **Deploy**.
7. Deploy — Railway runs `pnpm build` and `pnpm start`, which applies `drizzle/` migrations automatically before starting the Node server.

## Architecture and Guides

- [STRUCTURE.md](./STRUCTURE.md) — Folder map and module placement rules.
- [docs/BLUEPRINT.md](./docs/BLUEPRINT.md) — System architecture, tech stack, routes and workflows.
- [docs/DEV_TRAIL.md](./docs/DEV_TRAIL.md) — Chronological development log and verified milestones.
