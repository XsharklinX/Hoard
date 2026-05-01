export interface AppSettings {
  language: 'en' | 'es'
  showReadingTime: boolean
  defaultItemType: 'link' | 'note' | 'image' | 'code'
  compactView: boolean
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
  type: 'link' | 'note' | 'image' | 'code'
  title: string | null
  content: string | null
  url: string | null
  image_path: string | null
  favicon: string | null
  reading_time: number | null
  code_lang: string | null
  is_pinned: 0 | 1
  created_at: number
  updated_at: number
  tags: Tag[]
}

export interface CreateItemData {
  vaultId: number
  folderId?: number | null
  type: 'link' | 'note' | 'image' | 'code'
  title?: string
  content?: string
  url?: string
  imagePath?: string
  favicon?: string
  readingTime?: number
  codeLang?: string
  tagIds?: number[]
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
        list: (vaultId: number) => Promise<Folder[]>
        create: (vaultId: number, name: string, parentId?: number, smartQuery?: string) => Promise<Folder>
        update: (id: number, name: string, smartQuery?: string) => Promise<Folder>
        delete: (id: number) => Promise<void>
      }
      items: {
        counts: (vaultId: number) => Promise<{ all: number, link: number, note: number, image: number, code: number }>
        list: (params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: ItemType | null }) => Promise<Item[]>
        create: (data: CreateItemData) => Promise<Item>
        update: (id: number, data: Partial<CreateItemData>) => Promise<Item>
        pin: (id: number, pinned: boolean) => Promise<void>
        delete: (id: number) => Promise<void>
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
      }
      util: {
        fetchMetadata: (url: string) => Promise<UrlMetadata>
        saveImage: (filePath: string) => Promise<string>
        openImageDialog: () => Promise<string | null>
        openUrl: (url: string) => Promise<void>
      }
      bookmarks: {
        import: (vaultId: number) => Promise<{ count: number; cancelled?: boolean }>
      }
      // Push events: main → renderer (extension server notifications)
      on:  (channel: string, cb: (...args: unknown[]) => void) => ((...args: unknown[]) => void)
      off: (channel: string, handler: (...args: unknown[]) => void) => void
    }
  }
}
