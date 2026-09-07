import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      // 'png' is deliberately not in this list: the two icons below are already added to the manifest once
      // by includeAssets/includeManifestIcons, reading from public/. Globbing the build output for '*.png'
      // too would add the same two files a second time under the same URL, and Cache.addAll() (used in
      // src/sw.js's install handler) throws InvalidStateError on duplicate requests — the service worker
      // would then never finish installing, in every browser.
      injectManifest: {globPatterns: ['**/*.{js,css,html}', 'img/**/*.webp'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024},
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'HTLGI London 2026 Planner', short_name: 'HTLGI 2026',
        description: 'Unofficial planner for the HowTheLightGetsIn London festival, 19–20 September 2026.',
        start_url: '/', scope: '/', display: 'standalone', background_color: '#F3F4F1', theme_color: '#17191C',
        icons: [{src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}],
      },
    }),
  ],
  build: {sourcemap: true},
  test: {environment: 'jsdom', setupFiles: ['./tests/setup.js'], include: ['src/**/*.test.{js,jsx}'], css: false, globals: true},
});
