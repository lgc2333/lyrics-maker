import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './platform/i18n'
import router from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(router).use(pinia).use(i18n).mount('#app')
