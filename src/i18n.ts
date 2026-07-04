import { createI18n } from 'vue-i18n'
import fr from './locales/fr.json'
import en from './locales/en.json'

const i18n = createI18n({
  locale: 'fr', // default locale
  fallbackLocale: 'en',
  messages: {
    fr,
    en
  },
  legacy: false // use Vue 3 Composition API
})

export default i18n
