import { applyTranslations } from './i18n.js'

applyTranslations()

document.getElementById('doneBtn').addEventListener('click', () => {
  window.close()
})
