# sacretrogame.club

Website for the Sac Retro Game Club. The homepage shows the next monthly meetup.
`/meeting-vote` and `/results` hold the ranked choice vote that picked the
schedule: day and time, week of the month, and which library branch, with a map
of the branches and drive time estimates from an address. Voting is closed and
the results stay up.

`/game-of-the-month` is where members choose the next game together. Between
meetups, signed-in members nominate up to two games each (searched from IGDB, or
typed in by hand with an optional info link; a Wikipedia link also brings in the
box art). Voting opens an hour before the meetup and closes 15 minutes
before it ends, and the page shows the instant runoff count live so the room can
watch the winner come in. People sign in with Discord (members of the club
server), Google, or a link sent by email.

## Develop

```sh
pnpm install
pnpm dev     # http://localhost:3000
pnpm test
```

Without `DATABASE_URL`, the site uses an in-memory Postgres
([PGlite](https://pglite.dev)) with `db/schema.sql` applied, so it runs with no
setup. Tests always use it. Without `GOOGLE_MAPS_API_KEY`, drive time lookups
are disabled. Without `RESEND_API_KEY` in development, sign-in links are printed
to the server log instead of emailed.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (set by the Vercel Neon integration) |
| `GOOGLE_MAPS_API_KEY` | Server-side key for the Geocoding and Routes APIs |
| `DISCORD_WEBHOOK_URL` | Optional. Channel webhook that gets a results summary whenever a ballot is saved |
| `VOTING_CLOSES_AT` | Optional ISO timestamp. Overrides the closing time set in `src/data/polls.ts`, after which ballots are rejected |
| `SITE_URL` | Public origin, such as `https://sacretrogame.club`. Used for OAuth redirects and emailed links |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth app. Redirect URI: `<SITE_URL>/api/auth/discord/callback` |
| `DISCORD_GUILD_ID` | Only members of this Discord server can sign in with Discord |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client. Redirect URI: `<SITE_URL>/api/auth/google/callback` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sends sign-in links. `EMAIL_FROM` defaults to `Sac Retro Game Club <login@sacretrogame.club>` |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch app credentials for IGDB game search |
| `DISCORD_GOTM_WEBHOOK_URL` | Optional. Channel webhook for new nominations, voting opening, and the winner |
| `ADMIN_DISCORD_IDS`, `ADMIN_EMAILS` | Comma separated. Hosts who can open or close the game vote early and remove nominations |

Poll options live in `src/data/polls.ts` and branches in `src/data/libraries.ts`.
The meeting schedule shown on the homepage lives in `src/data/meeting.ts`, and the
game of the month picks in `src/data/games.ts`. Vote winners show up on the
homepage by themselves; an entry in `games.ts` for the same month takes over, to
add art and links. Game of the month limits and timing are in `src/data/gotm.ts`.

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

For the game of the month, the site stores each member's display name, the id
Discord or Google gives their account, and their email address (only for signing
in and recognizing the same person across sign-in options, never shown).
Session and sign-in link tokens are stored only as hashes. Who voted is public;
how anyone ranked the games is not.
