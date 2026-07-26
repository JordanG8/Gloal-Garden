/**
 * One definition of "is this an acceptable photo URL", previously copy-pasted
 * into plant-actions (twice) and profile-actions.
 *
 * Photos belong in Vercel Blob. Without `BLOB_READ_WRITE_TOKEN` the upload
 * route falls back to returning a base64 data URL, which then gets stored in a
 * Postgres text column — at roughly 20x the price of Blob ($0.35/GB-month
 * against $0.023/GB-month, before base64's +33% inflation) and dragged through
 * every feed and map query that selects the column.
 *
 * That fallback is a local-development convenience, so the app boots with zero
 * storage configuration. In production it is refused: the upload route won't
 * mint one and these validators won't accept one, so a hand-crafted request
 * can't smuggle a couple of megabytes into a row either.
 */

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;
const HTTP_URL_RE = /^https?:\/\//;

/** ~1.5 MB of image once base64 decoding is accounted for. */
export const MAX_DATA_URL_LENGTH = 2_100_000;

export function inlinePhotosAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** True for an absent photo, a real URL, or — outside production — a data URL. */
export function isValidPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (HTTP_URL_RE.test(url)) return true;
  return inlinePhotosAllowed() && DATA_URL_RE.test(url) && url.length <= MAX_DATA_URL_LENGTH;
}

export function isDataUrl(url: string | null | undefined): boolean {
  return !!url && DATA_URL_RE.test(url);
}
