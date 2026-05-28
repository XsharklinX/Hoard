import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface AppSettings {
  language: 'en' | 'es'
  showReadingTime: boolean
  showFavicons: boolean
  defaultItemType: 'link' | 'note' | 'image' | 'code'
  compactView: boolean
  minimizeToTray: boolean
  encryptionEnabled: boolean
  autoLockMinutes: number
  autoBackupEnabled: boolean
  autoBackupPath: string
  autoBackupIntervalDays: number
  autoBackupLastRun: number
  launchAtStartup: boolean
  hasSeenWelcome: boolean
  theme: 'dark' | 'light' | 'midnight'
  viewMode: 'grid' | 'list'
  sortBy: 'newest' | 'oldest' | 'az' | 'za' | 'pinned' | 'readingtime'
  aiProvider: 'none' | 'ollama' | 'claude' | 'gemini'
  aiOllamaUrl: string
  aiOllamaModel: string
  aiClaudeApiKey: string
  aiGeminiApiKey: string
  syncFolderPath: string
  syncFolderEnabled: boolean
  autoArchiveEnabled: boolean
  autoArchiveAfterDays: number
  autopurgeDeadLinksEnabled: boolean
  autopurgeDeadLinksAfterDays: number
}

const DEFAULTS: AppSettings = {
  language: 'en',
  showReadingTime: true,
  showFavicons: true,
  defaultItemType: 'link',
  compactView: false,
  minimizeToTray: true,
  encryptionEnabled: false,
  autoLockMinutes: 0,
  autoBackupEnabled: false,
  autoBackupPath: '',
  autoBackupIntervalDays: 7,
  autoBackupLastRun: 0,
  launchAtStartup: false,
  hasSeenWelcome: false,
  theme: 'dark',
  viewMode: 'grid',
  sortBy: 'newest',
  aiProvider: 'none',
  aiOllamaUrl: 'http://localhost:11434',
  aiOllamaModel: 'llama3',
  aiClaudeApiKey: '',
  aiGeminiApiKey: '',
  syncFolderPath: '',
  syncFolderEnabled: false,
  autoArchiveEnabled: false,
  autoArchiveAfterDays: 30,
  autopurgeDeadLinksEnabled: false,
  autopurgeDeadLinksAfterDays: 90
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
