# Current API Contract

SpinRank uses a single action envelope over `POST /api`.

Request shape:

```ts
interface ApiEnvelope<TAction, TPayload> {
  action: TAction;
  requestId: string;
  payload: TPayload;
  sessionToken?: string;
}
```

Response shape:

```ts
interface ApiResponse<TData> {
  ok: boolean;
  data: TData | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  requestId: string;
}
```

Session behavior:

- `bootstrapUser` is the only unauthenticated write action.
- All other actions require `sessionToken` in the envelope.
- Session tokens are app-issued JWTs with a one-hour TTL.
- The frontend stores the full session in local storage and clears it on expiry.

Known drift resolved by the Cloudflare implementation:

- `deactivateMatch` existed in the frontend contract but not in Apps Script.
- `getDashboard` did not exist in the original contract and is now added for the Worker cutover.
- The Worker contract adds creator/status metadata needed for read-only states and soft-delete UX.

Phase-1 action matrix:

| Action | Frontend contract existed | Apps Script implemented it | Cloudflare phase |
| --- | --- | --- | --- |
| `health` | yes | yes | keep |
| `bootstrapUser` | yes | yes | keep |
| `getDashboard` | no | no | add |
| `getLeaderboard` | yes | yes | keep |
| `getUserProgress` | yes | yes | keep |
| `getSegmentLeaderboard` | yes | yes | keep |
| `getMatches` | yes | yes | keep |
| `createMatch` | yes | yes | keep |
| `createSeason` | yes | yes | keep |
| `createTournament` | yes | yes | keep |
| `createSegmentShareLink` | yes | no | add |
| `redeemSegmentShareLink` | yes | no | add |
| `getSeasons` | yes | yes | keep |
| `getTournaments` | yes | yes | keep |
| `getTournamentBracket` | yes | yes | keep |
| `deactivateMatch` | yes | no | add |
| `deactivateTournament` | no | no | add |
| `deactivateSeason` | no | no | add |

Payload summary:

- `bootstrapUser`: `{ provider, idToken, nonce, profile? }`
- `getDashboard`: `{ matchesLimit?, matchesFilter?: MatchFeedFilter }`
- `getLeaderboard`: `{}`
- `getUserProgress`: `{}` (response now includes `currentRank`, `bestRank`, `currentElo`, `bestElo`, `currentStreak`, `bestStreak`, `wins`, `losses`, and `points[]` entries with `playedAt`, `elo`, `delta`, `label`, and an optional `rank`)
- `getSegmentLeaderboard`: `{ segmentType, segmentId }`
- `getMatches`: `{ cursor?, limit?, filter?: MatchFeedFilter }` (`filter` can be `recent`, `mine`, or `all`)
- `createMatch`: ranked match payload with optional season/tournament/bracket linkage
- `createSeason`: season metadata, participants, ranking mode, visibility
- `createTournament`: tournament metadata, participants, bracket rounds
- `createSegmentShareLink`: `{ segmentType, segmentId }` (returns `shareToken`, `expiresAt`, and the redirect `url` for the frontend)
- `redeemSegmentShareLink`: `{ shareToken }` (returns `{ segmentType, segmentId, segmentName, joined }`)
- `getSeasons`: `{}`
- `getTournaments`: `{ seasonId? }`
- `getTournamentBracket`: `{ tournamentId }`
- `deactivate*`: `{ id, reason? }`

`LeaderboardEntry` notes:

- Global and tournament leaderboards continue to use `elo`, `wins`, `losses`, `streak`, and `rank`.
- Season leaderboards now also expose `seasonScore`, `seasonGlickoRating`, `seasonGlickoRd`, `seasonConservativeRating`, `seasonAttendancePenalty`, `seasonAttendedWeeks`, and `seasonTotalWeeks`.
- Season score is based on conservative Glicko skill (`rating - 2 * rd`) with a small attendance penalty for missed season weeks.
- Tournament matches linked to a season count toward both the tournament leaderboard and the parent season leaderboard.
