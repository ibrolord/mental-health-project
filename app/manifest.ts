import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MHtoolkit',
    short_name: 'MHtoolkit',
    description:
      'Burned out? A 2-minute daily reset: check in, write one line, pick one small step. Free, open-source, no ads.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f4e9',
    theme_color: '#183e35',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
