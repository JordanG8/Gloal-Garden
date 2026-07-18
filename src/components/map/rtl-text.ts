import { setRTLTextPlugin } from 'maplibre-gl';

let registered = false;

/**
 * MapLibre GL doesn't shape or reorder right-to-left scripts (Hebrew, Arabic)
 * on its own — without this plugin, Hebrew place labels bake into the tiles in
 * raw logical order and render visually reversed ("הדע תעבג" instead of
 * "גבעת עדה"). It must be registered once, globally, before any map mounts.
 *
 * The plugin is self-hosted from /public so we don't depend on a third-party
 * CDN at runtime. `lazy: true` defers the ~400 KB download until a map actually
 * needs to draw RTL text. Safe to call repeatedly; only the first call runs.
 */
export function ensureRtlTextPlugin(): void {
  if (registered || typeof window === 'undefined') return;
  registered = true;
  try {
    setRTLTextPlugin('/mapbox-gl-rtl-text.js', true);
  } catch {
    // Already registered (e.g. across a fast-refresh) — nothing to do.
  }
}
