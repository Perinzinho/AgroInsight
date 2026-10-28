import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})