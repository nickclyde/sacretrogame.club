# sacretrogame.club

Website for the Sac Retro Game Club. The homepage shows the next monthly meetup.
`/meeting-vote` and `/results` hold the ranked choice vote that picked the
schedule: day and time, week of the month, and which library branch, with a map
of the branches and drive time estimates from an address. Voting is closed and
the results stay up.

## Develop

```sh
pnpm install
pnpm dev     # http://localhost:3000
pnpm test
```

Without `DATABASE_URL`, ballots are kept in memory so the site runs with no
setup. Without `GOOGLE_MAPS_API_KEY`, drive time lookups are disabled.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (set by the Vercel Neon integration) |
| `GOOGLE_MAPS_API_KEY` | Server-side key for the Geocoding and Routes APIs |
| `DISCORD_WEBHOOK_URL` | Optional. Channel webhook that gets a results summary whenever a ballot is saved |
| `VOTING_CLOSES_AT` | Optional ISO timestamp. Overrides the closing time set in `src/data/polls.ts`, after which ballots are rejected |

Poll options live in `src/data/polls.ts` and branches in `src/data/libraries.ts`.
The meeting schedule shown on the homepage lives in `src/data/meeting.ts`, and the
game of the month picks in `src/data/games.ts`.

## Setup scripts

- `scripts/gcp-setup.sh`: creates the GCP project, enables APIs, creates the restricted key.
- `pnpm migrate`: applies `db/schema.sql` to the database in `.env.local`.
- `scripts/dns.sh`: points the domain at Vercel through the Cloudflare API.

## How votes are counted

Instant runoff (`src/lib/irv.ts`). Voters may rank any subset. Each round the
last-place option is eliminated and its ballots move to their next pick, until
one option has more than half of the ballots still in play. Elimination ties are
broken by fewest first-round votes, then lowest Borda score, then list order.

Addresses entered for drive times are used for a single lookup and are never
stored or logged.
