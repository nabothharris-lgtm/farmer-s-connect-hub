import { defineConfig } from 'vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    viteReact(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
  ],
})
