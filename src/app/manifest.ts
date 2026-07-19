import type { MetadataRoute } from 'next';

/**
 * Web app manifest so the garden installs to the home screen like a native
 * app (the whole UI is already mobile-first). Served at /manifest.webmanifest;
 * icons come from scripts/generate-icons.ts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Global Garden',
    short_name: 'Garden',
    description: 'A community map for public food plants.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F2',
    theme_color: '#17402B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
