/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpeg', 'logo-192.png', 'logo-512.png'],
      manifest: {
        name:             'JAS Store',
        short_name:       'JAS',
        description:      'Sistema de gestión JAS Store',
        theme_color:      '#7c3aed',
        background_color: '#ffffff',
        display:          'standalone',
        start_url:        '/',
        icons: [
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) return 'react-vendor';
          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('/date-fns/')) return 'date-utils';
        },
      },
    },
  },
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
