export function msg(key, fallback = '') {
  return chrome.i18n?.getMessage(key) || fallback || key
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = msg(el.dataset.i18n, el.textContent)
  })
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = msg(el.dataset.i18nPlaceholder, el.placeholder)
  })
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = msg(el.dataset.i18nTitle, el.title)
  })
}
