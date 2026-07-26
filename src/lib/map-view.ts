import 'server-only';
import { cookies } from 'next/headers';
import { parseView, VIEW_COOKIE, type MapView } from './map-bounds';

/**
 * Where the map should open on the server-rendered first paint.
 *
 * The map client writes `gg_view` on move (same pattern as `gg_locale`), so a
 * returning visitor gets their own neighbourhood rendered on the server
 * instead of a flash of somewhere else. First-ever visit falls back to Givat
 * Ada, and the client corrects to real geolocation once it has permission.
 *
 * This replaces averaging the coordinates of every plant in the database,
 * which needed an unbounded read and produced the centroid of a global point
 * cloud — a spot in the sea — as soon as data spanned more than one town.
 */
export async function getInitialView(): Promise<MapView> {
  const store = await cookies();
  return parseView(store.get(VIEW_COOKIE)?.value);
}
