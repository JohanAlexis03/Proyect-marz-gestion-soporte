import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true -> también escucha en la red local, para probar desde el celular
    host: true,
    proxy: {
      // El frontend llama a /api y Vite lo deriva al backend en el puerto 4000
      '/api': 'http://localhost:4000',
    },
  },
})
