import { NextResponse, type NextRequest } from 'next/server';
import { getGardenData, getMapPoints, type MapFilter } from '@/lib/data';
import { boundsAround, parseBounds, PIN_ZOOM, type MapBounds } from '@/lib/map-bounds';

/**
 * Viewport-scoped map reads. The client calls this on a debounced `moveend`;
 * the first paint is server-rendered by the map page itself.
 *
 * Deliberately not wrapped in `use cache` — the bbox is continuous, so the hit
 * rate would be near zero and the cache would just add work. The client caches
 * by quantized bbox+zoom instead, which is where the reuse actually is.
 *
 * Note there is no route-segment config here: `cacheComponents` rejects
 * `export const dynamic` / `revalidate`, and the reads in `data.ts` already
 * call `connection()` themselves.
 */

const FILTERS: MapFilter[] = ['all', 'water', 'harvest', 'steward', 'trouble'];

function parseFilter(raw: string | null): MapFilter {
  return FILTERS.includes(raw as MapFilter) ? (raw as MapFilter) : 'all';
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const zoom = Number(params.get('zoom'));
  const filter = parseFilter(params.get('filter'));

  let bounds: MapBounds | null = parseBounds(params.get('bbox'));
  if (!bounds) {
    // Read the raw strings first: `Number(null)` is 0, so a missing lat/lng
    // would otherwise sail through `Number.isFinite` and silently return the
    // Gulf of Guinea instead of a 400.
    const rawLat = params.get('lat');
    const rawLng = params.get('lng');
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      rawLat === null ||
      rawLng === null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return NextResponse.json({ error: 'A valid bbox or lat/lng is required.' }, { status: 400 });
    }
    bounds = boundsAround({ lat, lng, zoom: Number.isFinite(zoom) ? zoom : 16 });
  }

  // Close enough to see individual plants: full summaries so the photo pins
  // and the in-place card have everything they need. Zoomed out: the slim
  // point format, which MapLibre clusters client-side.
  if (Number.isFinite(zoom) && zoom < PIN_ZOOM) {
    const points = await getMapPoints(bounds);
    return NextResponse.json({ tier: 'cluster', points });
  }

  const { plants, truncated, counts, dbReady } = await getGardenData(bounds, filter);
  return NextResponse.json({ tier: 'pins', plants, truncated, counts, dbReady });
}
