# Global Garden — architecture

How this codebase is put together, and the conventions that keep it working.
Read this before changing anything; the boundaries here are strict and mostly
mechanical, and several of them are not what a default Next.js instinct would
suggest.

A rendered version of this document, with an ER diagram and the full debt
register, is published as an artifact. This file is the source of truth for
day-to-day work.

---

## 1. Rules

These are load-bearing. Most of the bugs this project has accumulated came from
violating one of them.

1. **When a pure function takes a plant and a species, pass the whole row.**
   Never build a partial object literal. Every optional field you omit silently
   defaults to `null`, and the derivation quietly takes a different branch.
   This is exactly how the karma harvest gate was disabled for perennials.
2. **Adding a field to a derivation's input type means auditing every call
   site.** Optional fields fail silently; TypeScript will not flag a caller that
   drops them.
3. **Every `try/catch` around a database read opens with
   `rethrowIfPrerenderAbort(error)`.** See §5.
4. **Don't add `export const dynamic` / `revalidate` / `fetchCache`.** Under
   `cacheComponents` they're superseded by `use cache` + `cacheLife`, and
   `force-dynamic` is a no-op because pages are dynamic by default. Use
   `await connection()` to opt out of prerendering. Route segment config in
   `src/proxy.ts` is a hard build error.
5. **Any write that changes when a plant was watered must recompute
   `plants.water_due_at`** via `nextWaterDueAt()`. Nothing else maintains it.
6. **Counters are incremented in SQL** (`set karma = karma + 10`), never
   read-modify-write. The Neon HTTP driver cannot hold a transaction open.
7. **All user-facing error strings are dictionary keys**, never English prose.
   The app is bilingual with full RTL; prose in a server action is a bug.
8. **Nothing that the app needs in order to be correct goes in the nightly
   cron.** It does not run on preview deployments. See §6.
9. **A `'use server'` file exports async functions and nothing else.** Shared
   constants belong in a neutral module — `map-bounds.ts` is the established
   pattern.
10. **Green checks mean less than they look like.** All four `npm run check`
    scripts test pure functions only. Nothing tests a call site, a query, a
    component or a server action. If you change a call site, say plainly that
    you have no automated safety net.

---

## 2. Stack

| Package | Role | Notes |
| --- | --- | --- |
| `next` 16.2.6 | Framework | `cacheComponents: true` — changes the rules substantially, see §5 |
| `react` 19.2.4 | UI | Server Components by default; `viewTransition` enabled |
| `drizzle-orm` | Query builder | Typed SQL builder, not a heavy ORM. Schema in TS, migrations in SQL |
| `@neondatabase/serverless` | DB driver (prod) | HTTP. **No interactive transactions** — this shaped the write layer |
| `pg` | DB driver (fallback) | Any non-Neon connection string. Behaves differently on batches, see §7 |
| `next-auth` v5 beta | Auth | JWT sessions; credentials + optional Auth0-brokered Google |
| `maplibre-gl` / `react-map-gl` | Map | Free OpenFreeMap tiles; clustering is MapLibre's own (Supercluster) |
| `@vercel/blob` | Photos | Inline data-URL fallback outside production |
| `tailwindcss` v4 + `shadcn` | Styling | "Grove" tokens live in `src/app/globals.css` |
| `tsx` | Scripts | Seeds, migrations, checks. **No test framework is installed** |

---

## 3. The core principle: state is derived, not stored

If you remember one thing, make it this. There are three tiers of truth, and
knowing which tier a value lives in tells you where its bugs will be.

**Tier 1 — pure derivation.** `care-schedule.ts`, `karma.ts`,
`plant-status.ts`, `map-bounds.ts`. Zero imports, no database, no React. Given a
plant row and a species row, compute the answer: `computeStatus()`,
`needsWater()`, `readyToHarvest()`, `isUpForAdoption()`, `computeAward()`.
A plant's status is **not a column** — `plants.status` only stores *sticky*
states (`needs_attention`, `diseased`, `dormant`, `removed`); everything else is
computed on every read.

**Tier 2 — materialized on write.** `plants.water_due_at` only. The one derived
value written down, because the nightly sweep and the map's water filter both
need an indexed range scan rather than per-row logic. See rule 5.

**Tier 3 — denormalized counters.** `users.karma`, `plants.photo_count`,
`plants.latest_photo_url`, `gardens.plant_count`, `zones.plant_count` /
`post_count` / `member_count`. Pure performance; each has an authoritative
source elsewhere. **This is the tier that drifts.**

---

## 4. File-naming law

Filename tells you what a module is allowed to do.

| Pattern | Directive | May contain | Must not |
| --- | --- | --- | --- |
| `*-actions.ts` | `'use server'` | Mutations called from client components | Export anything that isn't an async function |
| `*-data.ts`, `data.ts` | `'server-only'` | Reads called during render | Be imported by a client component; export runtime values clients need |
| pure logic | none | Types, constants, pure functions | Import the database, React, or anything server-only |
| `components/**` | `'use client'` where interactive | Rendering, local state | Query the database directly |

`map-bounds.ts` exists because of this rule: `MapFilter`, `PIN_ZOOM` and
`STATUS_CODES` are needed at runtime in the browser, but `data.ts` is
`server-only`, so importing a *value* from it would break the client bundle.
`data.ts` re-exports the *types* for backwards compatibility. Same reasoning
puts `pinStatus()` in `plant-status.ts` rather than in the client component that
mainly uses it.

---

## 5. Next.js 16 with cacheComponents

- **Everything is a prerender candidate.** Any read touching request-time data
  must opt out explicitly, which is why nearly every function in `data.ts` opens
  with `await connection()`.
- **`src/proxy.ts` is what used to be `middleware.ts`.** It handles locale
  negotiation; every path lives under `/en` or `/he`. Don't add a
  `middleware.ts` beside it.
- **`params` is a Promise.** Every page and layout does
  `const { locale } = await params`.
- **Only two reads are cached** with `use cache`: the species catalog
  (`cacheLife('days')`) and garden metadata (`cacheLife('hours')`). Everything
  else is dynamic. `updateTag()` is the Next 16 read-your-own-writes
  invalidation call and may **only** be used inside a Server Action.

### The prerender-abort trap

React aborts a prerender the instant it hits request-time data, and *rejects*
any in-flight database promise rather than awaiting it. A naive `try/catch`
treats that rejection as a dead database and returns an empty result that looks
perfectly valid — the symptom was a live garden rendering as an empty map with
an error card.

`src/lib/prerender.ts` is the fix: `rethrowIfPrerenderAbort(error)` walks the
`cause` / `sourceError` chain looking for framework digests buried under Drizzle
and Neon wrappers. See rule 3.

---

## 6. The nightly cron is deliberately trivial

Because state is derived, `/api/cron/care-sweep` is not load-bearing. Its own
comment says it: *if this job never runs, the app is still right; it just stops
telling people about it.*

That design exists because Vercel's Hobby plan runs crons once daily at an
imprecise hour and **never runs them on preview deployments** — so a design that
needed the sweep would be broken in exactly the environment you test in. Never
move correctness into that job.

It currently sends notifications and reconciles `gardens.plant_count` and
`zones.plant_count`. Nothing reconciles `users.karma` against the ledger.

---

## 7. Writes, and why they look like that

The Neon HTTP driver has no interactive transactions. `src/db/index.ts` exposes
`runBatch()`, which on Neon issues `db.batch()` — one atomic round trip — and on
any other connection string **awaits the statements sequentially with no
transaction and no rollback**. Partial-failure behaviour therefore differs
between production and local development.

A care action (`logCareAction`, the app's central write) runs:

1. `requireUserId()` then `emailVerificationBlocker()` — the anti-sybil gate
2. `computeStatus()` for the **pre-action** status (karma needs to know the
   plant was in trouble *before* you touched it — that's what pays the rescue
   bonus)
3. Five parallel reads: photo verification, per-user cooldown, per-plant
   cooldown, latest open alert, karma earned in the trailing 24 h
4. `computeAward(ctx)` — pure; applies the ×1.5 community multiplier, cooldowns,
   age gates and the daily cap
5. Insert the observation alone first — the ledger rows carry an FK to it
6. `runBatch([update plants, insert karma_events, update users.karma])`
7. Badge evaluation, then `revalidatePath()`

---

## 8. Data model

19 tables. Five decisions define it.

**Spatial without PostGIS.** `plants`, `gardens` and `zones` carry `lat`/`lng`
as source of truth plus a generated `geo` column — `point(lng, lat)` with a GiST
index. That answers every spatial query the app makes: viewport boxes via
`geo <@ box(...)`, nearest via `<->`. Note the argument order:
`point(x, y)` means `point(lng, lat)`.

**Containers are optional.** `plants.garden_id` is nullable on purpose — a lemon
tree leaning over a street wall belongs to nobody's garden. Beds are a plain
`bed_label` text column, not a table: a bed has a name and no behaviour, so
"water this bed" is `where garden_id = ? and bed_label = ?`.

**Trees are not vegetables.** `species` carries two harvest models side by side:

| Shape | Ripeness from | Watering from |
| --- | --- | --- |
| Annual | `days_to_harvest` ±7 days from planting | `watering_frequency_days` (legacy single interval) |
| Perennial (`is_perennial = 1`) | `harvest_month_start`–`end`, may wrap the year, gated by `years_to_first_harvest` | `water_interval_summer_days` / `winter_days` |

Plus `plants.care_mode`: `scheduled`, `rain_fed` (doubles the summer interval,
never due in winter) or `observe_only` (never due — someone else's tree). And
`origin` / `planted_at_precision`, so "sometime in the nineties" is storable.

**Generated and materialized columns over cron jobs.** `plants.geo` is generated
always. `posts.hot_rank` is a stored generated column — Reddit's formula is
time-monotone, so an old post's rank never needs revisiting and no ranking job
exists. `plants.water_due_at` is materialized on write.

**Integer arrays for trees.** `zones.ancestor_ids` and `comments.path` are
`integer[]`, emphatically not JSON: JSON has no ordering operator, and casting
to text to sort would place `[10]` before `[9]`, scrambling any thread past nine
comments. Integer arrays compare element-wise and numerically, which *is* tree
order, and take a GIN index.

A zone is simultaneously a place and a subreddit — the geographic boundary, the
feed scope and the moderation unit are one object. Named zones are seeded;
anything outside one falls into a lazily-created ~5 km grid cell, so a plant
dropped anywhere on earth still has a community.

---

## 9. Known debt

Ranked. Items 1 and 2 were verified against the code, not inferred.

1. ~~`logCareAction` drops fields into `computeAward`~~ — **fixed**; see
   §1 rule 1 for why it happened and rule 2 for how to avoid repeating it.
2. **The checks can only test one third of the code.** No test framework is
   installed; four hand-written assertion scripts cover the pure tier only. On a
   clean install, `tsc --noEmit`, `eslint` and all four scripts exit 0 — and did
   so while the karma harvest gate was disabled in production. The
   highest-leverage addition to this repo is a test that calls `logCareAction`
   against a real database and asserts the awarded points.
3. **`runBatch` is atomic on Neon and a bare loop everywhere else.** A partial
   failure locally leaves an observation and a karma increment with no ledger
   row — permanent drift, since nothing reconciles `users.karma`.
4. **Hebrew users see English error messages.** Server actions return dictionary
   keys in a few places and raw English prose in most. See rule 7.
5. **The care model is hardcoded to the northern hemisphere.**
   `care-schedule.ts` defines summer as months 4–10 as a module constant, while
   the map layer goes to real trouble to be global (antimeridian crossings,
   viewports dragged around the world). Those two facts contradict each other;
   `plants.lat` is already stored if you want to resolve it.
6. **`revalidatePath('/[locale]', 'layout')` on almost every write.** Correct,
   but it discards every cached page for that locale on a single watering.
   `garden-actions.ts` already demonstrates the better pattern with
   `gardenTag()` + `updateTag()`.
7. **Three watering-cadence systems coexist.** Per-plant seasonal override →
   species seasonal → `species.watering_frequency_days` (legacy) → hardcoded
   default. `activityWindowDays()` in `karma.ts` reads the legacy column
   *exclusively*, so stewardship decay ignores seasonality.
8. **Dead schema.** `plants.expected_harvest_at` is never read or written
   anywhere. `plants.access_notes` survives in summaries but was removed from
   the UI. `notifications` rows are written by the cron but no screen shows them.
9. **`STATUS_COLOR.steward` and `.dormant` are the same hex** (`#8A6E4F`), so
   those two states are indistinguishable everywhere.

---

## 10. Commands

```bash
npm install          # required — typecheck and lint are meaningless without it
npm run dev
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src scripts
npm run check        # the four pure-logic assertion scripts
npm run db:push      # push schema changes
npm run db:seed
```
