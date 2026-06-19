/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpeg'],
      manifest: {
        name:             'JAS Store',
        short_name:       'JAS',
        description:      'Sistema de gestión JAS Store',
        theme_color:      '#7c3aed',
        background_color: '#ffffff',
        display:          'standalone',
        start_url:        '/',
        icons: [
          { src: '/logo.jpeg', sizes: '192x192', type: 'image/jpeg' },
          { src: '/logo.jpeg', sizes: '512x512', type: 'image/jpeg' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
