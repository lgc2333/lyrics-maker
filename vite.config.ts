import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'

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
  ],
})
