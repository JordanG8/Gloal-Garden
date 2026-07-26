import 'dotenv/config';
import { db } from '../src/db';
import { observations, users } from '../src/db/schema';
import { eq, like, sql } from 'drizzle-orm';

/**
 * Moves inline base64 photos out of Postgres and into Vercel Blob.
 *
 * Before Blob became mandatory in production, the upload route fell back to
 * returning a `data:` URL which was then stored directly in
 * `observations.photo_url` and `users.avatar`. Postgres storage runs
 * $0.35/GB-month against Blob's $0.023/GB-month, base64 inflates the payload by
 * a third on top of that, and — worse than the money — every feed and map query
 * that selects those columns drags the image bytes along with it.
 *
 * Re-runnable: it only ever selects rows still holding a `data:` URL, so an
 * interrupted run resumes where it stopped, and a completed run is a no-op.
 *
 *   BLOB_READ_WRITE_TOKEN=... POSTGRES_URL=... npx tsx scripts/migrate-photos-to-blob.ts
 *   ... --dry-run     report what would move, change nothing
 */

const BATCH_SIZE = 25;
const DRY_RUN = process.argv.includes('--dry-run');

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function decodeDataUrl(dataUrl: string): { body: Buffer; contentType: string } | null {
  // Matched against the prefix only, then sliced — a base64 payload can contain
  // newlines, and the dot-all flag needs an ES2018 target this project doesn't use.
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const base64 = dataUrl.slice(match[0].length);
  if (!base64) return null;
  try {
    return { body: Buffer.from(base64, 'base64'), contentType };
  } catch {
    return null;
  }
}

async function uploadToBlob(
  dataUrl: string,
  keyPrefix: string
): Promise<string | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;

  const { put } = await import('@vercel/blob');
  const extension = EXTENSIONS[decoded.contentType] ?? 'jpg';
  const blob = await put(`${keyPrefix}.${extension}`, decoded.body, {
    access: 'public',
    addRandomSuffix: true,
    contentType: decoded.contentType,
  });
  return blob.url;
}

interface Tally {
  moved: number;
  failed: number;
  skipped: number;
}

/** A row holding an inline photo, plus how to store the replacement URL. */
interface PhotoRow {
  id: number;
  dataUrl: string;
  keyPrefix: string;
}

async function migrate(
  label: string,
  fetchBatch: () => Promise<PhotoRow[]>,
  writeUrl: (id: number, url: string) => Promise<unknown>
): Promise<Tally> {
  const tally: Tally = { moved: 0, failed: 0, skipped: 0 };

  for (;;) {
    const rows = await fetchBatch();
    if (rows.length === 0) break;

    for (const row of rows) {
      // Check decodability up front so a dry run reports what would actually
      // move. The demo seed writes `data:image/svg+xml;utf8,…` photos, which
      // match the LIKE but aren't base64 and aren't an allowed upload type —
      // counting them as movable would overstate the saving.
      const decoded = decodeDataUrl(row.dataUrl);
      if (!decoded) {
        console.warn(`  ${label} ${row.id}: not a base64 JPEG/PNG/WebP, leaving in place`);
        tally.skipped += 1;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  would move ${label} ${row.id} (${decoded.body.length} bytes)`);
        tally.moved += 1;
        continue;
      }
      try {
        const url = await uploadToBlob(row.dataUrl, row.keyPrefix);
        if (!url) {
          tally.skipped += 1;
          continue;
        }
        await writeUrl(row.id, url);
        tally.moved += 1;
      } catch (error) {
        console.error(`  ${label} ${row.id} failed:`, error);
        tally.failed += 1;
      }
    }

    // Nothing was written, so the same batch would come back forever. Also
    // stop once a batch is entirely un-migratable, for the same reason.
    if (DRY_RUN || tally.skipped >= rows.length) break;
  }

  return tally;
}

async function main() {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error('POSTGRES_URL or DATABASE_URL is required.');
  }
  if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is required. Run with --dry-run to preview without it.'
    );
  }

  // A plain `select` rather than `db.execute`: the Neon HTTP driver returns
  // rows as an array while node-postgres wraps them in `{ rows }`, and this
  // script has to run against both.
  const [sizes] = await db
    .select({
      obsBytes: sql<number>`coalesce((
        select sum(length(photo_url)) from observations where photo_url like 'data:image/%'
      ), 0)::bigint`,
      avatarBytes: sql<number>`coalesce((
        select sum(length(avatar)) from users where avatar like 'data:image/%'
      ), 0)::bigint`,
    })
    .from(sql`(select 1) as _`);

  const totalMb = (Number(sizes.obsBytes) + Number(sizes.avatarBytes)) / 1_048_576;
  console.log(
    `${DRY_RUN ? '[dry run] ' : ''}Inline photos currently in Postgres: ${totalMb.toFixed(2)} MB`
  );

  console.log('Observations…');
  const obs = await migrate(
    'observation',
    async () =>
      (
        await db
          .select({
            id: observations.id,
            userId: observations.userId,
            photoUrl: observations.photoUrl,
          })
          .from(observations)
          .where(like(observations.photoUrl, 'data:image/%'))
          .limit(BATCH_SIZE)
      ).map((row) => ({
        id: row.id,
        dataUrl: row.photoUrl!,
        keyPrefix: `plants/${row.userId}/${row.id}`,
      })),
    (id, url) => db.update(observations).set({ photoUrl: url }).where(eq(observations.id, id))
  );

  console.log('Avatars…');
  const avatars = await migrate(
    'user',
    async () =>
      (
        await db
          .select({ id: users.id, avatar: users.avatar })
          .from(users)
          .where(like(users.avatar, 'data:image/%'))
          .limit(BATCH_SIZE)
      ).map((row) => ({
        id: row.id,
        dataUrl: row.avatar!,
        keyPrefix: `avatars/${row.id}`,
      })),
    (id, url) => db.update(users).set({ avatar: url }).where(eq(users.id, id))
  );

  const moved = obs.moved + avatars.moved;
  const failed = obs.failed + avatars.failed;
  const skipped = obs.skipped + avatars.skipped;
  console.log(
    `${DRY_RUN ? 'Would move' : 'Moved'} ${moved} photo(s) to Blob` +
      (skipped ? `, ${skipped} left in place (not base64 JPEG/PNG/WebP)` : '') +
      (failed ? `, ${failed} failed — re-run to retry them.` : '.')
  );
  if (!DRY_RUN && moved > 0) {
    console.log('Reclaim the space with: VACUUM FULL observations, users;');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
