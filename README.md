# SpinRank

SpinRank is a Vite frontend backed by a Cloudflare Worker and D1 database. The frontend still talks to the backend through a single action-envelope `POST /api` contract.

## Stack

- Frontend: Vite + TypeScript
- Backend: Cloudflare Workers
- Database: Cloudflare D1
- Auth: Google Sign-In, with app-issued session tokens

## Prerequisites

- Node.js 20+ with `npm`
- A Cloudflare account with D1 and Workers enabled
- A Google OAuth client ID for Google Identity Services

## Project layout

- Frontend app: [src/](/Users/mariusavram/Projects/spinrank-main/src)
- Worker app: [worker/](/Users/mariusavram/Projects/spinrank-main/worker)
- Contract notes: [docs/current-api-contract.md](/Users/mariusavram/Projects/spinrank-main/docs/current-api-contract.md)
- Local seed data: [worker/seed/dev_seed.sql](/Users/mariusavram/Projects/spinrank-main/worker/seed/dev_seed.sql)

## Local setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install Worker dependencies

```bash
cd worker
npm install
cd ..
```

### 3. Create the D1 databases

From the `worker` directory:

```bash
cd worker
npx wrangler d1 create spinrank-db
npx wrangler d1 create spinrank-e2e-db
```

This prints the database IDs you need for [worker/wrangler.toml](/Users/mariusavram/Projects/spinrank-main/worker/wrangler.toml). Replace:

- `env.dev.d1_databases[0].database_id`
- `env.dev.d1_databases[0].preview_database_id`
- `env.e2e.d1_databases[0].database_id`
- `env.e2e.d1_databases[0].preview_database_id`

The checked-in `env.e2e` IDs are intentionally dummy placeholder UUIDs, so replace them before using the e2e Worker environment.

If you want separate preview and production databases, create both and set the IDs explicitly.

### 4. Configure Worker vars and secrets

`worker/wrangler.toml` already contains:

- `APP_ENV`
- `APP_ORIGIN`

Set the secrets from the `worker` directory:

```bash
cd worker
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put APP_SESSION_SECRET
```

Use:

- `GOOGLE_CLIENT_ID`: your Google web client ID
- `APP_SESSION_SECRET`: a long random secret used to sign session tokens

### 5. Apply local migrations

```bash
cd worker
npm run db:local:migrate
npm run db:local:migrate:e2e
```

### 6. Seed local data

```bash
cd worker
npm run db:local:seed
npm run db:local:seed:e2e
```

This loads the manual verification dataset from [worker/seed/dev_seed.sql](/Users/mariusavram/Projects/spinrank-main/worker/seed/dev_seed.sql).

### 7. Configure the frontend env file

Copy the example file:

```bash
cp .env.example .env.local
```

Current frontend env vars:

- `VITE_APP_ENV=dev`
- `VITE_API_BASE_URL=/api`
- `VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com`

Update at least:

- `VITE_GOOGLE_CLIENT_ID`

Keep `VITE_API_BASE_URL=/api` for local development so the Vite dev server can proxy requests to the local Worker.

### 8. Start the Worker

```bash
cd worker
npm run dev
```

By default the frontend proxies these local backend routes:

- `http://127.0.0.1:8787/api`

Health check:

- `http://127.0.0.1:8787/health`

### 9. Running tests

#### Frontend (repo root)

- `npm run test` — run every Vitest suite under `tests/` once. This is the default `test` script used by CI.
- `npm run test:watch` — keep Vitest running in watch mode while you work on the UI.
- `npm run test:unit` / `npm run test:integration` — focus on `tests/unit` or `tests/integration` when you only need that surface.
- `npm run test:coverage` — run Vitest with coverage reporting; results land in `coverage/`.
- `npm run test:e2e` — run the Playwright tests configured in `playwright.config.ts`. Install the browsers once with `npx playwright install` before running this script. This command starts the Vite frontend in `test` mode and a dedicated test Worker automatically.
- The Playwright global setup now applies the local `e2e` D1 migrations into an isolated Wrangler state directory before the Worker boots, so the browser suite no longer depends on a pre-migrated local test database.
- `npm run test:all` — sequentially runs `test:coverage` and `test:e2e` for a full handoff in one command.

For local e2e runs, Playwright boots the Vite dev server in `test` mode (loading `.env.test`) and spawns the Cloudflare Worker in test mode via `worker/dev:test`. The worker exposes the authenticated `/test/bootstrap-user` route and reads `TEST_AUTH_SECRET` from the Node environment, defaulting to `test-auth-secret`.

If you want to override the default local test secret, export it when you run the suite:

```bash
TEST_AUTH_SECRET=your-test-secret npm run test:e2e
```

Run every script from the repo root. Vitest inherits the Vite config, so `npm run typecheck` must succeed before tests can pass; fix any type errors before rerunning.

#### Worker (worker/)

- `npm run test` — from within `worker/`, this runs the worker-specific Vitest suites in `tests/unit/worker` and `tests/integration/worker`.
- You must `cd worker` before running npm scripts that reference the worker’s `package.json`.
- `npx wrangler` or the worker tests may rely on local D1 state and environment variables, so ensure the worker dependencies are installed and the same local setup steps (migrations, seeds) have been applied if the suites expect persisted data.

The worker tests share the repo’s TypeScript config, so rerun `npm run typecheck` in the root if you see build failures.

### 10. Start the frontend

From the repo root:

```bash
npm run dev
```

## Docker Compose convenience

If you prefer containers, the provided `docker-compose.yml` now defines two isolated stacks:

- `dev`: frontend + worker for day-to-day development on `5173` / `8787`
- `e2e`: frontend + worker dedicated to Playwright on `4173` / `8788`, plus a separate `e2e` runner container

The stacks use separate bridge networks, separate `node_modules` volumes, separate published ports, and separate Wrangler state volumes so they do not share runtime state or local D1 data.

1. Start the development stack:

   ```bash
   docker compose -p spinrank-dev --profile dev up --build worker-dev frontend-dev
   ```

   - Visit `http://localhost:5173` to see the frontend.
   - The worker API is available at `http://localhost:8787/api` and `/health`.
   - Override secrets or IDs from your shell only if you need to, for example:

   ```bash
   APP_SESSION_SECRET=... TEST_AUTH_SECRET=... VITE_GOOGLE_CLIENT_ID=... docker compose -p spinrank-dev --profile dev up --build worker-dev frontend-dev
   ```

   If you seed the local D1 database on your host, the Docker worker will not see that data because Docker uses its own Wrangler state volume. Seed the Docker-backed local database with:

   ```bash
   docker compose -p spinrank-dev --profile dev run --rm worker-dev npm run db:local:migrate
   docker compose -p spinrank-dev --profile dev run --rm worker-dev npm run db:local:seed
   ```

2. Start the isolated e2e stack when you want to inspect the test frontend/worker manually:

   ```bash
   docker compose -p spinrank-e2e --profile e2e up --build frontend-e2e worker-e2e
   ```

   The test frontend is exposed at `http://localhost:4173` and the test worker at `http://localhost:8788`.

3. Run Playwright inside the dedicated test container:

   ```bash
   docker compose -p spinrank-e2e --profile e2e run --rm e2e
   ```

   This is the simplest Docker e2e command because it brings up the required services automatically. If you already started `frontend-e2e` and `worker-e2e` separately, the same command reuses them.

   Or run the worker suites with `docker compose -p spinrank-e2e --profile e2e run --rm worker-e2e npm run test`.

4. When you are done, stop either stack without affecting the other:

   ```bash
   docker compose -p spinrank-dev down
   docker compose -p spinrank-e2e down
   ```

## Phone testing with a temporary Cloudflare Tunnel

If you want to open the dev app on your phone without changing your local network setup, you can expose the Vite frontend through a temporary Cloudflare Tunnel.

1. Start the local dev stack:

   ```bash
   docker compose -p spinrank-dev --profile dev up --build worker-dev frontend-dev
   ```

2. In a second terminal, create a temporary tunnel to the frontend:

   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```

   Cloudflare prints a temporary public URL such as:

   ```text
   https://example-tunnel-name.trycloudflare.com
   ```

3. Add the generated hostname to Google Cloud Console:

   - Open `APIs & Services > Credentials`.
   - Open your OAuth 2.0 Web Client.
   - Add the exact origin under `Authorized JavaScript origins`, for example:

   ```text
   https://example-tunnel-name.trycloudflare.com
   ```

4. Restart the Docker dev stack with the tunnel hostname wired into both Vite and the worker:

   ```bash
   APP_ORIGIN=https://example-tunnel-name.trycloudflare.com \
   __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=example-tunnel-name.trycloudflare.com \
   docker compose -p spinrank-dev --profile dev up --build worker-dev frontend-dev
   ```

5. Open the Cloudflare URL on your phone and test the app there.

Notes:

- `trycloudflare.com` hostnames are temporary. If you start a new tunnel and get a different hostname, update both the Google OAuth origin and `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`.
- Google Sign-In matches origins exactly. Use the full `https://...trycloudflare.com` origin and do not include a path.

## Verification

Frontend checks:

```bash
npm run typecheck
npm run build
```

Worker checks:

```bash
cd worker
npx tsc --noEmit
```

Basic local flow:

1. Start the Worker.
2. Start the frontend.
3. Sign in with Google.
4. Confirm dashboard data loads.
5. Create a season, tournament, and match.
6. Confirm leaderboard, progress, and recent matches update.
7. Confirm soft-delete actions recalculate rankings.

## Production deployment

The production stack runs on Cloudflare:

- **Frontend**: Cloudflare Pages builds the Vite app and serves it under a Pages domain.
- **Backend Worker**: A Cloudflare Worker (built via `wrangler publish`) powers the `/api` endpoints.
- **Database**: A Cloudflare D1 database for the production data.

### 1. Provision the production D1 database

Use `wrangler d1 create` from within `worker/` to create the prod database:

```bash
cd worker
npx wrangler d1 create spinrank-prod
```

Update `worker/wrangler.toml`:

- `database_id` → the new prod D1 ID
- `preview_database_id` → optional if you keep a separate preview database

After the database exists, run the remote migrations & seed data:

```bash
cd worker
npm run db:remote:migrate
```

If you keep a dedicated remote e2e database, migrate it separately:

```bash
cd worker
npm run db:remote:migrate:e2e
```

### 2. Wire the Worker secrets

Still inside `worker/`, set the production secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put APP_SESSION_SECRET
npx wrangler secret put APP_ORIGIN
```

- `GOOGLE_CLIENT_ID`: Google OAuth web client ID for the production origin.
- `APP_SESSION_SECRET`: long random string (used for signing sessions).
- `APP_ORIGIN`: the Cloudflare Pages URL (e.g., `https://spinrank.pages.dev`).

### 3. Deploy the Worker

The Worker deploys automatically when you push to `main` if you have configured a GitHub workflow that runs `npm run deploy` (see `worker/.github/workflows` or your custom action). If you prefer to deploy manually:

```bash
cd worker
npm run deploy
```

After deployment, note the Worker URL (something like `https://spinrank.worker.dev`). This becomes your production `VITE_API_BASE_URL`.

### 4. Configure Cloudflare Pages for the frontend

1. Go to Cloudflare Pages and create a new project connected to this repository.
2. Set the build command to:

   ```bash
   npm run typecheck && npm run build
   ```

3. Set the build output directory to `dist`.
4. Add production environment variables:

   | Name              | Value                                 |
   |------------------|----------------------------------------|
   | `VITE_APP_ENV`     | `prod`                                 |
   | `VITE_API_BASE_URL`| `https://<your-worker-domain>/api`     |
   | `VITE_GOOGLE_CLIENT_ID` | your production Google client ID |
   | `APP_ORIGIN`       | the Pages URL (e.g., `https://spinrank.pages.dev`) |

5. Enable automatic builds on pushes to `main`.

Pages will now run `npm install`, then the combined build command, and deploy the `dist` output to the Pages URL. Cloudflare caches the assets and injects the correct headers automatically.

### 5. GitHub workflow reference

The existing [.github/workflows/pages.yml](.github/workflows/pages.yml) shows the equivalent steps for a GitHub Pages build (checkout, install, typecheck, build). When you pivot to Cloudflare Pages, replicate that by:

- Running `npm run typecheck` before `npm run build` (as shown in the workflow).
- Ensuring `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` are supplied via Cloudflare Pages environment variables.
- Optionally copying the workflow logic into Pages via the `Build command` field, or keeping a GitHub Action that mirrors the Pages build but uploads to Cloudflare Pages using `cloudflare/pages-action`.

### 6. Post-deploy checklist

1. Point `VITE_API_BASE_URL` to the worker `/api` URL.
2. Confirm `APP_ORIGIN` (worker secret + Pages env var) matches the Pages domain.
3. Rebuild the frontend (either via Pages rebuild or rerun the workflow) whenever you change environment-dependent code.

## Notes

- The frontend uses a single action-envelope API instead of multiple REST routes.
- Google Sign-In is live; Apple Sign-In is still deferred.
- Local Worker state lives in `worker/.wrangler/state`.
