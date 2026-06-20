/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
        manualChunks: {
          'react-vendor':   ['react', 'react-dom', 'react-router-dom'],
          'supabase':       ['@supabase/supabase-js'],
          'date-utils':     ['date-fns', 'date-fns/locale'],
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
