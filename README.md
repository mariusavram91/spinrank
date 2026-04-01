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

### 3. Create the D1 database

From the `worker` directory:

```bash
cd worker
npx wrangler d1 create spinrank-db
```

This prints the database IDs you need for [worker/wrangler.toml](/Users/mariusavram/Projects/spinrank-main/worker/wrangler.toml). Replace:

- `database_id`
- `preview_database_id`

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
```

### 6. Seed local data

```bash
cd worker
npm run db:local:seed
```

This loads the manual verification dataset from [worker/seed/dev_seed.sql](/Users/mariusavram/Projects/spinrank-main/worker/seed/dev_seed.sql).

### 7. Configure the frontend env file

Copy the example file:

```bash
cp .env.example .env.local
```

Current frontend env vars:

- `VITE_APP_ENV=dev`
- `VITE_API_BASE_URL=http://127.0.0.1:8787/api`
- `VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com`

Update at least:

- `VITE_GOOGLE_CLIENT_ID`

Keep `VITE_API_BASE_URL` pointed at the local Worker unless you are intentionally testing against a deployed environment.

### 8. Start the Worker

```bash
cd worker
npm run dev
```

By default the frontend expects the Worker at:

- `http://127.0.0.1:8787/api`

Health check:

- `http://127.0.0.1:8787/health`

### 9. Start the frontend

From the repo root:

```bash
npm run dev
```

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
npm run db:remote:seed
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
