import { useStore } from '../store'
import { translations, type Locale } from './translations'

export { type Locale }

export function useT() {
  const language = useStore((s) => s.settings.language)
  return translations[language]
}
