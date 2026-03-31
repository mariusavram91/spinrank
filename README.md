# SpinRank

Milestone 1 authentication foundation for the SpinRank web app, currently scoped to Google Sign-In.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the frontend auth environment variables:
   - `VITE_API_BASE_URL`
   - `VITE_GOOGLE_CLIENT_ID`
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Required Apps Script properties

- `APP_ENV`
- `APP_SESSION_SECRET`
- `DATA_SPREADSHEET_ID`
- `GOOGLE_CLIENT_ID`

## Included in milestone 1

- Google Sign-In entry point in the frontend.
- Backend `bootstrapUser` action that validates Google tokens and issues an app session.
- Session persistence and expiry handling in the frontend shell.
- User upsert logic against the configured Google Sheet.
- Apple sign-in deferred until Apple Developer enrollment is available.
- Existing milestone 0 scaffold, typed contracts, and deployment workflows.
