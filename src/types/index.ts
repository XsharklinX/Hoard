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

export interface Vault {
  id: number
  name: string
  color: string
  created_at: number
  updated_at: number
}

export interface Folder {
  id: number
  vault_id: number
  parent_id: number | null
  name: string
  smart_query: string | null
  sort_order: number
  icon: string | null
  created_at: number
  updated_at: number
}

export interface Tag {
  id: number
  vault_id: number
  name: string
  color: string
  created_at: number
}

export interface Item {
  id: number
  vault_id: number
  folder_id: number | null
  type: 'link' | 'note' | 'image' | 'code' | 'quote' | 'file'
  title: string | null
  content: string | null
  url: string | null
  image_path: string | null
  favicon: string | null
  reading_time: number | null
  code_lang: string | null
  archive_path: string | null
  archive_status: 'pending' | 'done' | 'failed' | null
  link_status: 'ok' | 'dead' | 'unknown' | null
  read_status: 'unread' | 'read'
  is_pinned: 0 | 1
  attribution: string | null
  file_path: string | null
  file_size: number | null
  file_mime: string | null
  created_at: number
  updated_at: number
  tags: Tag[]
}

export interface CreateItemData {
  vaultId: number
  folderId?: number | null
  type: 'link' | 'note' | 'image' | 'code' | 'quote' | 'file'
  title?: string
  content?: string
  url?: string
  imagePath?: string
  favicon?: string
  readingTime?: number
  codeLang?: string
  tagIds?: number[]
  readStatus?: 'unread' | 'read'
  archiveStatus?: 'pending' | 'done' | 'failed'
  archivePath?: string
  attribution?: string
  filePath?: string
  fileSize?: number
  fileMime?: string
}

export interface UrlMetadata {
  title: string
  description?: string
  favicon?: string
  readingTime: number
  thumbnailPath?: string
  channel?: string
}

export type ItemType = Item['type']

export interface SecurityStatus {
  locked: boolean
  encryptionEnabled: boolean
  hasEncryptedDb: boolean
}

declare global {
  interface Window {
    api: {
      vaults: {
        list: () => Promise<Vault[]>
        create: (name: string, color: string) => Promise<Vault>
        update: (id: number, name: string, color: string) => Promise<Vault>
        delete: (id: number) => Promise<void>
      }
      folders: {
        list:    (vaultId: number) => Promise<Folder[]>
        create:  (vaultId: number, name: string, parentId?: number, smartQuery?: string, icon?: string) => Promise<Folder>
        update:  (id: number, name: string, smartQuery?: string, icon?: string) => Promise<Folder>
        reorder: (orderedIds: number[]) => Promise<void>
        delete:  (id: number) => Promise<void>
      }
      items: {
        counts:       (vaultId: number) => Promise<{ all: number, link: number, note: number, image: number, code: number, quote: number, file: number }>
        list:         (params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: ItemType | null; readStatus?: string | null }) => Promise<Item[]>
        create:       (data: CreateItemData) => Promise<Item>
        update:       (id: number, data: Partial<CreateItemData>) => Promise<Item>
        pin:          (id: number, pinned: boolean) => Promise<void>
        delete:       (id: number) => Promise<void>
        setReadStatus:(id: number, status: 'unread' | 'read') => Promise<void>
        move:         (id: number, targetVaultId: number, targetFolderId?: number | null) => Promise<Item>
        copy:         (id: number, targetVaultId: number, targetFolderId?: number | null) => Promise<Item>
        duplicate:    (id: number) => Promise<Item>
        folderCounts: (vaultId: number) => Promise<Record<number, number>>
        searchItems:  (vaultId: number, q: string) => Promise<Array<{ id: number; title: string | null; type: string }>>
        searchGlobal: (q: string) => Promise<Item[]>
        openReader:   (archivePath: string, title: string) => Promise<void>
        tagSelected:  (ids: number[], tagIds: number[]) => Promise<void>
        versionsList: (itemId: number) => Promise<Array<{ id: number; created_at: number }>>
        versionGet:   (versionId: number) => Promise<{ id: number; item_id: number; content: string; created_at: number } | null>
        versionSave:  (itemId: number, content: string) => Promise<void>
        checkLinks:   (vaultId: number) => Promise<{ checked: number }>
      }
      tags: {
        list: (vaultId: number) => Promise<Tag[]>
        create: (vaultId: number, name: string, color: string) => Promise<Tag>
        delete: (id: number) => Promise<void>
        setItemTags: (itemId: number, tagIds: number[]) => Promise<void>
      }
      settings: {
        load: () => Promise<AppSettings>
        save: (patch: Partial<AppSettings>) => Promise<AppSettings>
        openDataFolder: () => Promise<void>
        getDataPath: () => Promise<string>
        chooseBackupDir: () => Promise<string | null>
      }
      util: {
        fetchMetadata:   (url: string) => Promise<UrlMetadata>
        saveImage:       (filePath: string) => Promise<string>
        openImageDialog: () => Promise<string | null>
        openUrl:         (url: string) => Promise<void>
        exportImage:     (srcPath: string) => Promise<{ success?: boolean; cancelled?: boolean; filePath?: string }>
        exportImages:    (srcPaths: string[]) => Promise<{ success?: boolean; cancelled?: boolean; copied?: number; folder?: string }>
        openFileDialog:  () => Promise<string | null>
        saveFile:        (filePath: string) => Promise<{ storedPath: string; size: number; mime: string }>
        openFile:        (storedPath: string) => Promise<void>
        extractReader:   (archivePath: string) => Promise<{ title: string; content: string } | null>
      }
      bookmarks: {
        import: (vaultId: number) => Promise<{ count: number; cancelled?: boolean }>
      }
      security: {
        getStatus: () => Promise<SecurityStatus>
        unlock: (password: string) => Promise<{ success: boolean; error?: string }>
        verifyPassword: (password: string) => Promise<boolean>
        enableEncryption: (password: string) => Promise<{ success: boolean }>
        disableEncryption: (password: string) => Promise<{ success: boolean; error?: string }>
        changePassword: (oldPw: string, newPw: string) => Promise<{ success: boolean; error?: string }>
      }
      backup: {
        export:     () => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>
        import:     () => Promise<{ success?: boolean; cancelled?: boolean }>
        exportHtml: () => Promise<{ success?: boolean; cancelled?: boolean; path?: string }>
        exportJson: (folderPath: string) => Promise<{ success?: boolean; count?: number; error?: string }>
      }
      app: {
        getVersion:          () => Promise<string>
        checkUpdates:        () => Promise<{ error?: string }>
        installUpdate:       () => Promise<void>
        openExtensionFolder: () => Promise<void>
        closeWindow:         () => Promise<void>
      }
      ai: {
        summarize: (params: {
          text: string
          provider: string
          ollamaUrl?: string
          ollamaModel?: string
          claudeApiKey?: string
          geminiApiKey?: string
        }) => Promise<{ summary?: string; error?: string }>
      }
      on:  (channel: string, cb: (...args: unknown[]) => void) => ((...args: unknown[]) => void)
      off: (channel: string, handler: (...args: unknown[]) => void) => void
    }
  }
}
