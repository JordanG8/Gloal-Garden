# 🌱 Global Garden

A community map for public food plants. Drop a pin where you planted something edible, and your neighborhood keeps it alive together — watering, photographing, harvesting, and flagging problems.

## Features

- **Live map** of every public plant, with status-colored markers (healthy, needs water, harvest ready, needs attention)
- **Add plants** by tapping the map — species, nickname, access notes
- **Care actions**: log watering, photos, harvests, and issue reports; reports flag the plant until someone marks it healthy
- **Activity feed** per plant showing who did what, when
- **Status filters** (needs water / harvest ready / critical / freshly planted / needs a steward) and a "near me" button
- **Accounts** with email + password (NextAuth credentials)
- **Stewardship**: the planter is the plant's permanent founder; anyone else can *adopt* a plant to become a steward. Stewards who stop caring decay out, and neglected plants are flagged "needs a steward" on the map
- **Karma**: action points earned only for care that helps real food — watering plants that are actually due, photo updates, verified harvests, confirmed problem reports, rescues. Caring for *other people's* plants pays 1.5×
- **Trust levels** (Seedling → Sprout → Gardener → Caretaker → Garden Elder) unlock privileges: higher adoption caps, resolving alerts on plants you don't steward, editing plant details
- **Badges, public profiles** (`/users/[id]`) **and a leaderboard** (`/ranks`) with all-time and 7-day karma
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

A plant's marker color is computed at read time from species data:

- **Needs water** — last watering is older than the species' watering frequency
- **Harvest ready** — plant age is within a week of the species' days-to-harvest
- **Needs attention / diseased** — set by issue reports, sticky until someone hits *Mark Healthy*
- **Growing** — everything else

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
| `npx tsx scripts/karma-check.ts` | Assert the karma economy's anti-abuse rules |
