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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Requisition list + detail — NetworkFirst, 5 s timeout, fall back to cache
            urlPattern: /^\/api\/requisitions/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-requisitions',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Department list — NetworkFirst, rarely changes
            urlPattern: /^\/api\/departments/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-departments',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Workflow stages — StaleWhileRevalidate (infrequently updated)
            urlPattern: /^\/api\/workflow-stages/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-workflows',
              expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Notifications — NetworkFirst, short cache window
            urlPattern: /^\/api\/notifications/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-notifications',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Audit logs — NetworkFirst
            urlPattern: /^\/api\/audit-logs/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-audit',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
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
