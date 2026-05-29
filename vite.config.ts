import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'

function readPackageVersion(): string {
  try {
    const pkgUrl = new URL('./package.json', import.meta.url)
    const pkgRaw = readFileSync(fileURLToPath(pkgUrl), 'utf8')
    return JSON.parse(pkgRaw).version ?? 'dev'
  } catch {
    return 'dev'
  }
}

function readGitShortCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() || 'dev'
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readPackageVersion()),
    __APP_COMMIT__: JSON.stringify(readGitShortCommit()),
  },
  plugins: [
    VueRouter({ dts: 'src/typed-router.d.ts' }),
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({ dts: 'src/components.d.ts' }),
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
