# 🌱 Global Garden

A community map for public food plants. Drop a pin where you planted something edible, and your neighborhood keeps it alive together — watering, photographing, harvesting, and flagging problems.

## Features

- **Live map** of every public plant, with status-colored markers (healthy, needs water, harvest ready, needs attention)
- **Add plants** by tapping the map — species, nickname, access notes
- **Care actions**: log watering, photos, harvests, and issue reports; reports flag the plant until someone marks it healthy
- **Activity feed** per plant showing who did what, when
- **Status filters** (needs water / harvest ready / critical / freshly planted) and a "near me" button
- **Accounts** with email + password (NextAuth credentials), contribution stats tracked per user

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
   npm run db:push
   npm run db:seed
   ```

   The seed creates a downtown-LA demo garden and a demo account:
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

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:seed` | Seed demo users, species, and plants |
