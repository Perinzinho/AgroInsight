import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { readConfig } from './server/config.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'AI_')
  const { AI_HOST, AI_PORT } = readConfig({ AI_HOST: process.env.AI_HOST ?? env.AI_HOST, AI_PORT: process.env.AI_PORT ?? env.AI_PORT })
  return {
  plugins: [react()],
  server: { proxy: { '/api/ai': { target: `http://${AI_HOST === '::1' ? '[::1]' : AI_HOST}:${AI_PORT}`, changeOrigin: false } } },
  build: {
    rollupOptions: {
      output: {
        /*
         * Chart.js e Leaflet entram na bundle inteira e nao mudam entre telas.
         * Separa-los mantem o chunk do produto pequeno e deixa o cache do navegador
         * valer para as duas bibliotecas.
         */
        manualChunks: {
          charts: ['chart.js'],
          map: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  test: {
// Os scripts de `scripts/` rodam em Node puro; os testes de `src/` usam jsdom.
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.mjs'],
  /*
   * Criar um jsdom por arquivo custa caro e o setup nao depende do arquivo sob
   * teste. `vmThreads` mantem o isolamento por arquivo sem recriar o ambiente.
   */
  pool: 'vmThreads',
  },
  }
})
