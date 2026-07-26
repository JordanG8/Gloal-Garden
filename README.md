# 🌱 Global Garden

A community map for public food plants. Drop a pin where you planted something edible, and your neighborhood keeps it alive together — watering, photographing, harvesting, and flagging problems.

## Features

- **Live map** of every public plant, paged by viewport: photo pins close in, clustered dots
  further out, and community counts at country scale. Status-colored (healthy, needs water,
  harvest ready, needs attention)
- **Add plants** by dragging the map — species typeahead with free-text fallback, nickname, photo
- **Already-planted plants**: say whether you planted it or it was simply there. A street tree you
  only mapped is never yours to water, never reads as thirsty, and never asks for a steward
- **Seasonal watering**: separate summer and winter cadences, because a lemon wants water every
  ten days in July and none at all in January
- **Gardens and beds**: group nearby plants into a patch, a garden, or a shared community plot;
  water a whole bed in one tap
- **Care actions**: log watering, photos, harvests, and issue reports; reports flag the plant until someone marks it healthy
- **Activity feed** per plant showing who did what, when
- **Status filters** (needs water / harvest ready / critical / needs a steward) and a "near me" button
- **Community feed**: every place is also a community. Post, comment, vote and moderate in your
  neighbourhood, with harvest giveaways, pest warnings and questions scoped to where you actually are
- **Accounts** with email + password (NextAuth credentials)
- **Stewardship**: the planter is the plant's permanent founder; anyone else can *adopt* a plant to become a steward. Stewards who stop caring decay out, and neglected plants are flagged "needs a steward" on the map
- **Karma**: action points earned only for care that helps real food — watering plants that are actually due, photo updates, verified harvests, confirmed problem reports, rescues. Caring for *other people's* plants pays 1.5×
- **Trust levels** (Seedling → Sprout → Gardener → Caretaker → Garden Elder) unlock privileges: higher adoption caps, resolving alerts on plants you don't steward, editing plant details
- **Badges, public profiles** (`/users/[id]`) **and per-community leaderboards** — "top gardeners
  in Givat Ada" beats a worldwide ranking nobody can place themselves in
- **Installable** as a home-screen app (web app manifest + icons); regenerate icons with `npx tsx scripts/generate-icons.ts`

## Stack

Next.js (App Router, Server Actions) · Drizzle ORM · Neon Postgres · NextAuth v5 · MapLibre GL + OpenStreetMap tiles · Tailwind CSS v4

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in:

   - `POSTGRES_URL` — a [Neon](https://neon.tech) Postgres connection string
   - `AUTH_SECRET` — generate with `npx auth secret`

3. **Create tables and seed demo data**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   The seed creates a Givat Ada demo garden — including adoptions, a lapsed
   steward, a plant up for adoption, and a karma ledger replayed through the
   real economy rules — plus a demo account:
   **demo@globalgarden.app / garden123**

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Without a configured database the app still runs, but shows a setup banner and an empty map.

## How status works

A plant's marker color is computed at read time (`src/lib/care-schedule.ts`):

- **Needs water** — past its *seasonal* interval. Plant override beats species; an interval of `0`
  means "the rain does it", and a plant you only mapped is never due at all
- **Harvest ready** — for a tree, the calendar month falls inside its fruiting window and it's old
  enough to bear. A mature lemon crops every winter no matter when it went in the ground; only
  annuals use the old countdown from planting
- **Needs attention / diseased** — set by issue reports, sticky until someone hits *Mark Healthy*
- **Growing** — everything else

## How places work

A zone is both a geographic boundary and a community — the map scope, the feed scope and the
moderation unit are the same object. Zones nest (neighbourhood → city → region → country), so a
district feed picks up its neighbourhoods' posts. Anywhere outside a seeded place falls into an
automatically created ~5km cell, so a plant dropped anywhere on earth still has somewhere to talk
about it.

## How karma works

Karma is a ledger (`karma_events`), not a mutable counter — every award is recorded, zero-point
entries double as cooldown markers, and negative moderation adjustments are supported. The whole
economy (point values, cooldowns, caps, trust levels, badges) lives in `src/lib/karma.ts`, and
`npx tsx scripts/karma-check.ts` asserts the anti-abuse rules hold.

Anti-abuse by design:

- Watering only pays when the plant was actually **due** (from species watering frequency)
- Plants must be **photo-verified** before harvests pay or founder bonuses trigger
- **Reports pay nothing at filing** — the reporter is paid retroactively when a *different* user
  confirms and resolves the alert, so false flags never pay; low-trust reports also don't flip
  plant status
- Per-user **and per-plant** cooldowns (harvest, resolve) stop alt-account rotation
- Rolling daily caps, with a tighter cap for brand-new accounts
- Planting pays a small amount up front; the real founder bonuses arrive when the plant proves
  real (30 days + care from 2+ people, and its first harvest)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply committed Drizzle migrations |
| `npm run db:push` | Push the Drizzle schema to the database (dev shortcut) |
| `npm run db:seed` | Seed demo users, species, plants, adoptions, and karma |
| `npm run db:seed -- --scale=large` | Also seed 11 edge-case personas (RTL, a 120-plant plot, 30 street citrus, antipodal coordinates, a 30-deep thread, every empty state) — all sign in with `garden123` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src` and `scripts` |
| `npm run check` | Assert the karma economy, seasonal care logic, and bulk-watering caps |
| `npx tsx scripts/migrate-photos-to-blob.ts --dry-run` | Report inline photos still sitting in Postgres |

## Photos

Photos belong in Vercel Blob (`$0.023/GB-month` against Postgres's `$0.35`). Without
`BLOB_READ_WRITE_TOKEN` local development falls back to inline data URLs so the app runs with no
storage configured; production refuses them. `scripts/migrate-photos-to-blob.ts` moves existing
rows across.

## Scheduled work

`vercel.json` runs `/api/cron/care-sweep` daily, guarded by `CRON_SECRET`. It notifies people about
thirsty plants and reconciles denormalized counters — nothing more. Status and due-ness are derived
at read time, so if the sweep never runs the app is still correct; it just stops telling anyone.
It also accepts `?token=$CRON_SECRET` so it can be triggered by hand, since Hobby-plan crons don't
run on preview deployments.
