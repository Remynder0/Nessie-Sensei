import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import i18n from './i18n'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

// Injections pour les métriques Vercel (Web Analytics & Speed Insights)
inject()
injectSpeedInsights()

const app = createApp(App)
app.use(i18n)
app.mount('#app')
