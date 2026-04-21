import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['CSS_Favicon.svg', 'CSS_Favicon.png', 'CSS_CSS_Group.png', 'CSS_Group.svg'],
      manifest: {
        name: 'CSS Group RMS',
        short_name: 'CSS RMS',
        description: 'Enterprise Requisition Management System',
        theme_color: '#206e33',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'CSS_Favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'CSS_Favicon.png',
            sizes: '320x317',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ],
  base: '/',
  build: { sourcemap: true },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
