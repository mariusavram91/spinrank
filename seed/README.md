Seed data for milestone 2 manual verification.

Import or paste each `.tsv` file into the matching Google Sheet tab:

- `users.tsv` -> `users`
- `seasons.tsv` -> `seasons`
- `tournaments.tsv` -> `tournaments`
- `elo_segments.tsv` -> `elo_segments`
- `matches.tsv` -> `matches`

Notes:

- These files are tab-separated so JSON fields paste cleanly into Sheets.
- Paste starting at cell `A1` in an empty tab.
- Keep the header row exactly as provided.
- The frontend read flow expects at least one season, one tournament, segment rows for both, and enough matches to page beyond the first 10 rows.
