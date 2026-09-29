import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true -> también escucha en la red local, para probar desde el celular
    host: true,
    // Vite 8 valida el header Host para evitar ataques de DNS rebinding y
    // bloquea cualquier dominio desconocido. El túnel público de Cloudflare
    // genera un subdominio distinto en cada arranque, así que se permite el
    // dominio .trycloudflare.com completo (el punto inicial incluye subdominios).
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // El frontend llama a /api y Vite lo deriva al backend en el puerto 4000
      '/api': 'http://localhost:4000',
    },
  },
})
