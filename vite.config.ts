import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'

// import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    VueRouter({ dts: 'src/typed-router.d.ts' }),
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({ dts: 'src/components.d.ts' }),
    // cloudflare()
  ],
  resolve: {
    alias: {
      // Stub Node.js worker_threads so WaveSurfer's spectrogram plugin doesn't
      // trigger Vite's externalization warning in the browser build.
      worker_threads: fileURLToPath(
        new URL('./src/platform/waveform/worker-threads-shim.ts', import.meta.url),
      ),
    },
  },
})
