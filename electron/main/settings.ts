import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface AppSettings {
  language: 'en' | 'es'
  showReadingTime: boolean
  defaultItemType: 'link' | 'note' | 'image' | 'code'
  compactView: boolean
}

const DEFAULTS: AppSettings = {
  language: 'en',
  showReadingTime: true,
  defaultItemType: 'link',
  compactView: false
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const updated = { ...loadSettings(), ...patch }
  fs.writeFileSync(settingsPath(), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
