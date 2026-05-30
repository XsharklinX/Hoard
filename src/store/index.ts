import { create } from 'zustand'
import type { Vault, Folder, Item, Tag, Feed, SavedSearch, CreateItemData, AppSettings, ItemType, SecurityStatus } from '../types'

interface HoardStore {
  // ── App state ──────────────────────────────────────────────────────────────
  appLocked:      boolean
  securityStatus: SecurityStatus

  // ── Data ──────────────────────────────────────────────────────────────────
  vaults:         Vault[]
  selectedVault:  Vault | null
  folders:        Folder[]
  selectedFolder: Folder | null
  selectedTag:    Tag | null
  items:          Item[]
  tags:           Tag[]
  searchQuery:    string
  sortBy:         'newest' | 'oldest' | 'az' | 'za' | 'pinned' | 'readingtime'
  lightboxItem:   Item | null
  isLoading:      boolean
  settings:       AppSettings
  selectedItem:   Item | null
  selectedType:   ItemType | 'all' | 'unread'
  itemCounts:     { all: number, link: number, note: number, image: number, code: number, quote: number, file: number }
  folderCounts:   Record<number, number>

  // ── Multi-select ──────────────────────────────────────────────────────────
  selectedIds:    Set<number>

  // ── Security actions ──────────────────────────────────────────────────────
  checkSecurity:  () => Promise<void>
  unlock:         (password: string) => Promise<boolean>
  lockApp:        () => void

  // ── Vault actions ─────────────────────────────────────────────────────────
  loadVaults:  () => Promise<void>
  selectVault: (vault: Vault) => Promise<void>
  createVault: (name: string, color: string) => Promise<void>
  updateVault: (id: number, name: string, color: string) => Promise<void>
  deleteVault: (id: number) => Promise<void>

  // ── Folder actions ────────────────────────────────────────────────────────
  selectFolder:  (folder: Folder | null) => Promise<void>
  reloadFolders: () => Promise<void>
  createFolder:  (name: string, parentId?: number, smartQuery?: string, icon?: string) => Promise<void>
  updateFolder:  (id: number, name: string, smartQuery?: string, icon?: string) => Promise<void>
  reorderFolders:(orderedIds: number[]) => Promise<void>
  deleteFolder:  (id: number) => Promise<void>

  // ── Tag actions ───────────────────────────────────────────────────────────
  selectTag:   (tag: Tag | null) => Promise<void>
  createTag:   (name: string, color: string) => Promise<Tag>
  deleteTag:   (id: number) => Promise<void>
  loadTags:    () => Promise<void>

  // ── Item actions ──────────────────────────────────────────────────────────
  setSearch:        (q: string) => Promise<void>
  setSort:           (sort: HoardStore['sortBy']) => void
  selectType:        (type: ItemType | 'all' | 'unread') => Promise<void>
  openLightbox:      (item: Item) => void
  closeLightbox:     () => void
  bulkSetReadStatus: (status: 'unread' | 'read') => Promise<void>
  setReadStatus:    (id: number, status: 'unread' | 'read') => Promise<void>
  loadCounts:       () => Promise<void>
  loadFolderCounts: () => Promise<void>
  createItem:       (data: Omit<CreateItemData, 'vaultId'>) => Promise<void>
  updateItem:       (id: number, data: Partial<CreateItemData>) => Promise<void>
  pinItem:          (id: number, pinned: boolean) => Promise<void>
  deleteItem:       (id: number) => Promise<void>
  duplicateItem:    (id: number) => Promise<void>
  selectItem:       (item: Item | null) => void
  moveItem:         (id: number, targetVaultId: number, targetFolderId?: number | null) => Promise<void>
  copyItem:         (id: number, targetVaultId: number, targetFolderId?: number | null) => Promise<void>

  // ── Multi-select actions ──────────────────────────────────────────────────
  toggleSelect:      (id: number) => void
  selectAll:         () => void
  clearSelection:    () => void
  deleteSelected:    () => Promise<void>
  moveSelected:      (targetVaultId: number, targetFolderId?: number | null) => Promise<void>

  // ── Settings actions ──────────────────────────────────────────────────────
  loadSettings:   () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>

  // ── Archive status push ───────────────────────────────────────────────────
  updateArchiveStatus: (id: number, status: Item['archive_status'], archivePath?: string) => void

  // ── Link status push ──────────────────────────────────────────────────────
  updateLinkStatus: (id: number, status: 'ok' | 'dead' | 'unknown') => void

  // ── Auto-summary push ─────────────────────────────────────────────────────
  autoSummaries: Record<number, string>
  setAutoSummary: (id: number, summary: string) => void

  // ── Recently viewed ───────────────────────────────────────────────────────
  recentlyViewed: Item[]
  addRecentlyViewed: (item: Item) => void

  // ── Saved searches ────────────────────────────────────────────────────────
  addSavedSearch:    (s: SavedSearch) => Promise<void>
  removeSavedSearch: (id: string)     => Promise<void>

  // ── Graph state ───────────────────────────────────────────────────────────
  graphOpen: boolean
  openGraph:  () => void
  closeGraph: () => void

  // ── Feed state ────────────────────────────────────────────────────────────
  feeds:            Feed[]
  selectedFeed:     Feed | null
  feedUnreadCounts: Record<number, number>
  loadFeeds:        () => Promise<void>
  selectFeed:       (feed: Feed | null) => Promise<void>
  createFeed:       (data: { url: string; intervalMinutes?: number; autoFolder?: boolean }) => Promise<Feed>
  updateFeed:       (id: number, data: Partial<{ url: string; title: string; intervalMinutes: number; folderId: number | null; enabled: number }>) => Promise<void>
  deleteFeed:       (id: number) => Promise<void>
  refreshFeed:      (id: number) => Promise<void>
  refreshAllFeeds:  () => Promise<void>
  refreshFeedCounts: () => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
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
  autopurgeDeadLinksAfterDays: 90,
  sortBy: 'newest',
  savedSearches: []
}

const DEFAULT_SECURITY: SecurityStatus = { locked: false, encryptionEnabled: false, hasEncryptedDb: false }

export const useStore = create<HoardStore>((set, get) => ({
  appLocked:      false,
  securityStatus: DEFAULT_SECURITY,
  vaults:         [],
  selectedVault:  null,
  folders:        [],
  selectedFolder: null,
  selectedTag:    null,
  items:          [],
  tags:           [],
  searchQuery:    '',
  sortBy:         'newest',
  lightboxItem:   null,
  isLoading:      false,
  settings:       DEFAULT_SETTINGS,
  selectedItem:   null,
  selectedType:   'all',
  itemCounts:       { all: 0, link: 0, note: 0, image: 0, code: 0, quote: 0, file: 0 },
  folderCounts:     {},
  selectedIds:      new Set(),
  autoSummaries:    {},
  recentlyViewed:   [],
  addRecentlyViewed: (item) => set((s) => ({
    recentlyViewed: [item, ...s.recentlyViewed.filter(r => r.id !== item.id)].slice(0, 10)
  })),

  addSavedSearch: async (search) => {
    const { settings, updateSettings } = get()
    const current = settings.savedSearches ?? []
    if (!current.find(s => s.id === search.id)) {
      await updateSettings({ savedSearches: [...current, search] })
    }
  },
  removeSavedSearch: async (id) => {
    const { settings, updateSettings } = get()
    await updateSettings({ savedSearches: (settings.savedSearches ?? []).filter(s => s.id !== id) })
  },

  graphOpen:        false,
  openGraph:        () => set({ graphOpen: true }),
  closeGraph:       () => set({ graphOpen: false }),
  feeds:            [],
  selectedFeed:     null,
  feedUnreadCounts: {},

  // ── Security ───────────────────────────────────────────────────────────────
  checkSecurity: async () => {
    const status = await window.api.security.getStatus()
    set({ securityStatus: status, appLocked: status.locked })
  },

  unlock: async (password) => {
    const result = await window.api.security.unlock(password)
    if (result.success) {
      set({ appLocked: false })
      await get().loadVaults()
    }
    return result.success
  },

  lockApp: () => set({ appLocked: true }),

  // ── Settings ───────────────────────────────────────────────────────────────
  loadSettings: async () => {
    const settings = await window.api.settings.load()
    set({ settings, sortBy: settings.sortBy ?? 'newest' })
  },

  updateSettings: async (patch) => {
    const settings = await window.api.settings.save(patch)
    set({ settings })
  },

  // ── Vaults ─────────────────────────────────────────────────────────────────
  loadVaults: async () => {
    await get().loadSettings()
    const vaults = await window.api.vaults.list()
    const prev    = get().selectedVault
    const current = prev ? vaults.find((v) => v.id === prev.id) ?? vaults[0] : vaults[0]
    set({ vaults })
    if (current) await get().selectVault(current)
  },

  selectVault: async (vault) => {
    set({ selectedVault: vault, selectedFolder: null, selectedTag: null, selectedType: 'all', selectedFeed: null, isLoading: true, selectedItem: null, selectedIds: new Set() })
    const [folders, items, tags, itemCounts, folderCounts, feeds, feedUnreadCounts] = await Promise.all([
      window.api.folders.list(vault.id),
      window.api.items.list({ vaultId: vault.id }),
      window.api.tags.list(vault.id),
      window.api.items.counts(vault.id),
      window.api.items.folderCounts(vault.id),
      window.api.feeds.list(vault.id),
      window.api.feeds.unreadCounts(vault.id)
    ])
    set({ folders, items, tags, itemCounts, folderCounts, feeds, feedUnreadCounts, isLoading: false })
  },

  createVault: async (name, color) => {
    const vault = await window.api.vaults.create(name, color)
    set((s) => ({ vaults: [...s.vaults, vault] }))
    await get().selectVault(vault)
  },

  updateVault: async (id, name, color) => {
    const vault = await window.api.vaults.update(id, name, color)
    set((s) => ({
      vaults:        s.vaults.map((v) => (v.id === id ? vault : v)),
      selectedVault: s.selectedVault?.id === id ? vault : s.selectedVault
    }))
  },

  deleteVault: async (id) => {
    await window.api.vaults.delete(id)
    const remaining = get().vaults.filter((v) => v.id !== id)
    set({ vaults: remaining })
    if (remaining.length > 0) await get().selectVault(remaining[0])
    else set({ selectedVault: null, folders: [], items: [], tags: [] })
  },

  // ── Folders ────────────────────────────────────────────────────────────────
  reloadFolders: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const [folders, folderCounts] = await Promise.all([
      window.api.folders.list(vault.id),
      window.api.items.folderCounts(vault.id)
    ])
    set({ folders, folderCounts })
  },

  selectFolder: async (folder) => {
    const vault = get().selectedVault
    if (!vault) return
    set({ selectedFolder: folder, selectedTag: null, selectedType: 'all', isLoading: true, selectedItem: null, selectedIds: new Set() })
    const items = await window.api.items.list({ vaultId: vault.id, folderId: folder?.id ?? null })
    set({ items, isLoading: false })
  },

  createFolder: async (name, parentId, smartQuery, icon) => {
    const vault = get().selectedVault
    if (!vault) return
    const folder = await window.api.folders.create(vault.id, name, parentId, smartQuery, icon)
    set((s) => ({ folders: [...s.folders, folder] }))
  },

  updateFolder: async (id, name, smartQuery, icon) => {
    const folder = await window.api.folders.update(id, name, smartQuery, icon)
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? folder : f)) }))
  },

  reorderFolders: async (orderedIds) => {
    await window.api.folders.reorder(orderedIds)
    set((s) => {
      const map = new Map(s.folders.map((f) => [f.id, f]))
      const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as Folder[]
      const rest = s.folders.filter((f) => !orderedIds.includes(f.id))
      return { folders: [...reordered, ...rest] }
    })
  },

  deleteFolder: async (id) => {
    await window.api.folders.delete(id)
    const wasSelected = get().selectedFolder?.id === id
    set((s) => ({
      folders:        s.folders.filter((f) => f.id !== id),
      selectedFolder: wasSelected ? null : s.selectedFolder
    }))
    if (wasSelected) await get().selectFolder(null)
  },

  // ── Tags ───────────────────────────────────────────────────────────────────
  loadTags: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const tags = await window.api.tags.list(vault.id)
    set({ tags })
  },

  selectTag: async (tag) => {
    const vault = get().selectedVault
    if (!vault) return
    set({ selectedTag: tag, selectedFolder: null, selectedType: 'all', isLoading: true, selectedItem: null, selectedIds: new Set() })
    const items = await window.api.items.list({ vaultId: vault.id, tagId: tag?.id ?? null })
    set({ items, isLoading: false })
  },

  createTag: async (name, color) => {
    const vault = get().selectedVault
    if (!vault) throw new Error('No vault selected')
    const tag = await window.api.tags.create(vault.id, name, color)
    set((s) => ({ tags: [...s.tags, tag] }))
    return tag
  },

  deleteTag: async (id) => {
    await window.api.tags.delete(id)
    set((s) => ({
      tags:        s.tags.filter((t) => t.id !== id),
      selectedTag: s.selectedTag?.id === id ? null : s.selectedTag,
      items:       s.items.map((item) => ({ ...item, tags: item.tags.filter((t) => t.id !== id) }))
    }))
  },

  // ── Items ──────────────────────────────────────────────────────────────────
  loadCounts: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const itemCounts = await window.api.items.counts(vault.id)
    set({ itemCounts })
  },

  loadFolderCounts: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const folderCounts = await window.api.items.folderCounts(vault.id)
    set({ folderCounts })
  },

  selectType: async (type) => {
    const vault = get().selectedVault
    if (!vault) return
    set({ selectedType: type, selectedFolder: null, selectedTag: null, isLoading: true, selectedItem: null, selectedIds: new Set() })
    const params = type === 'unread'
      ? { vaultId: vault.id, readStatus: 'unread' }
      : { vaultId: vault.id, type: type === 'all' ? null : type }
    const items = await window.api.items.list(params)
    set({ items, isLoading: false })
  },

  setReadStatus: async (id, status) => {
    await window.api.items.setReadStatus(id, status)
    set((s) => ({
      items:        s.items.map((i) => i.id === id ? { ...i, read_status: status } : i),
      selectedItem: s.selectedItem?.id === id ? { ...s.selectedItem, read_status: status } : s.selectedItem
    }))
  },

  setSort: (sort) => {
    set((s) => {
      const sorted = [...s.items]
      if (sort === 'newest')      sorted.sort((a, b) => b.id - a.id)
      if (sort === 'oldest')      sorted.sort((a, b) => a.id - b.id)
      if (sort === 'az')          sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      if (sort === 'za')          sorted.sort((a, b) => (b.title ?? '').localeCompare(a.title ?? ''))
      if (sort === 'pinned')      sorted.sort((a, b) => (b.is_pinned ?? 0) - (a.is_pinned ?? 0))
      if (sort === 'readingtime') sorted.sort((a, b) => (b.reading_time ?? 0) - (a.reading_time ?? 0))
      return { sortBy: sort, items: sorted }
    })
    window.api.settings.save({ sortBy: sort }).catch(console.error)
  },

  openLightbox:  (item) => set({ lightboxItem: item }),
  closeLightbox: ()     => set({ lightboxItem: null }),

  bulkSetReadStatus: async (status) => {
    const ids = [...get().selectedIds]
    await Promise.all(ids.map((id) => window.api.items.setReadStatus(id, status)))
    set((s) => ({
      items:        s.items.map((i) => ids.includes(i.id) ? { ...i, read_status: status } : i),
      selectedItem: s.selectedItem && ids.includes(s.selectedItem.id)
        ? { ...s.selectedItem, read_status: status }
        : s.selectedItem,
      selectedIds:  new Set()
    }))
  },

  setSearch: async (q) => {
    const vault = get().selectedVault
    if (!vault) return
    set({ searchQuery: q })
    if (!q.trim()) {
      const state = get()
      if (state.selectedFolder)   await state.selectFolder(state.selectedFolder)
      else if (state.selectedTag) await state.selectTag(state.selectedTag)
      else                        await state.selectType(state.selectedType)
      return
    }
    const items = await window.api.items.list({ vaultId: vault.id, search: q })
    set({ items })
  },

  createItem: async (data) => {
    const vault = get().selectedVault
    if (!vault) return
    await window.api.items.create({ ...data, vaultId: vault.id })
    await Promise.all([get().loadCounts(), get().loadFolderCounts()])
    const state = get()
    if (state.searchQuery.trim())    await state.setSearch(state.searchQuery)
    else if (state.selectedFolder)   await state.selectFolder(state.selectedFolder)
    else if (state.selectedTag)      await state.selectTag(state.selectedTag)
    else                             await state.selectType(state.selectedType)
  },

  updateItem: async (id, data) => {
    const updated = await window.api.items.update(id, data)
    set((s) => {
      let nextItems = s.items.map((i) => (i.id === id ? { ...i, ...updated } : i))
      if (s.selectedFolder && updated.folder_id !== undefined && updated.folder_id !== s.selectedFolder.id) {
        nextItems = nextItems.filter((i) => i.id !== id)
      }
      return {
        items:        nextItems,
        selectedItem: s.selectedItem?.id === id ? { ...s.selectedItem, ...updated } : s.selectedItem
      }
    })
    await get().loadCounts()
  },

  pinItem: async (id, pinned) => {
    await window.api.items.pin(id, pinned)
    set((s) => ({
      items: s.items
        .map((i) => (i.id === id ? { ...i, is_pinned: (pinned ? 1 : 0) as 0 | 1 } : i))
        .sort((a, b) => b.is_pinned - a.is_pinned)
    }))
  },

  deleteItem: async (id) => {
    const prev         = get().items
    const prevSelected = get().selectedItem
    set((s) => ({
      items:        s.items.filter((i) => i.id !== id),
      selectedItem: s.selectedItem?.id === id ? null : s.selectedItem,
      selectedIds:  new Set([...s.selectedIds].filter((x) => x !== id))
    }))
    try {
      await window.api.items.delete(id)
      await Promise.all([get().loadCounts(), get().loadFolderCounts()])
    } catch {
      set({ items: prev, selectedItem: prevSelected })
    }
  },

  selectItem: (item) => {
    set({ selectedItem: item })
    if (item) get().addRecentlyViewed(item)
  },

  moveItem: async (id, targetVaultId, targetFolderId) => {
    await window.api.items.move(id, targetVaultId, targetFolderId)
    set((s) => ({
      items:        s.items.filter((i) => i.id !== id),
      selectedItem: s.selectedItem?.id === id ? null : s.selectedItem,
      selectedIds:  new Set([...s.selectedIds].filter((x) => x !== id))
    }))
    await get().loadCounts()
  },

  copyItem: async (id, targetVaultId, targetFolderId) => {
    await window.api.items.copy(id, targetVaultId, targetFolderId)
  },

  duplicateItem: async (id) => {
    const vault = get().selectedVault
    if (!vault) return
    const newItem = await window.api.items.duplicate(id)
    set((s) => ({ items: [newItem, ...s.items] }))
    await get().loadCounts()
    await get().loadFolderCounts()
  },

  // ── Multi-select ───────────────────────────────────────────────────────────
  toggleSelect: (id) => set((s) => {
    const next = new Set(s.selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selectedIds: next }
  }),

  selectAll: () => set((s) => ({ selectedIds: new Set(s.items.map((i) => i.id)) })),

  clearSelection: () => set({ selectedIds: new Set() }),

  deleteSelected: async () => {
    const ids = [...get().selectedIds]
    set((s) => ({
      items:        s.items.filter((i) => !ids.includes(i.id)),
      selectedItem: ids.includes(s.selectedItem?.id ?? -1) ? null : s.selectedItem,
      selectedIds:  new Set()
    }))
    await Promise.all(ids.map((id) => window.api.items.delete(id)))
    await get().loadCounts()
  },

  moveSelected: async (targetVaultId, targetFolderId) => {
    const ids = [...get().selectedIds]
    await Promise.all(ids.map((id) => window.api.items.move(id, targetVaultId, targetFolderId)))
    set((s) => ({
      items:        s.items.filter((i) => !ids.includes(i.id)),
      selectedItem: ids.includes(s.selectedItem?.id ?? -1) ? null : s.selectedItem,
      selectedIds:  new Set()
    }))
    await get().loadCounts()
  },

  // ── Archive status push ────────────────────────────────────────────────────
  updateArchiveStatus: (id, status, archivePath) => {
    set((s) => ({
      items:        s.items.map((i) => i.id === id ? { ...i, archive_status: status, archive_path: archivePath ?? i.archive_path } : i),
      selectedItem: s.selectedItem?.id === id
        ? { ...s.selectedItem, archive_status: status, archive_path: archivePath ?? s.selectedItem.archive_path }
        : s.selectedItem
    }))
  },

  // ── Link status push ───────────────────────────────────────────────────────
  updateLinkStatus: (id, status) => {
    set((s) => ({
      items:        s.items.map((i) => i.id === id ? { ...i, link_status: status } : i),
      selectedItem: s.selectedItem?.id === id ? { ...s.selectedItem, link_status: status } : s.selectedItem
    }))
  },

  // ── Auto-summary push ──────────────────────────────────────────────────────
  setAutoSummary: (id, summary) => {
    set((s) => ({ autoSummaries: { ...s.autoSummaries, [id]: summary } }))
  },

  // ── Feed actions ──────────────────────────────────────────────────────────
  loadFeeds: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const [feeds, feedUnreadCounts] = await Promise.all([
      window.api.feeds.list(vault.id),
      window.api.feeds.unreadCounts(vault.id)
    ])
    set({ feeds, feedUnreadCounts })
  },

  selectFeed: async (feed) => {
    const vault = get().selectedVault
    if (!vault) return
    set({ selectedFeed: feed, selectedFolder: null, selectedTag: null, selectedType: 'all' })
    if (!feed) {
      await get().selectType('all')
      return
    }
    set({ isLoading: true })
    try {
      const items = await window.api.items.list({ vaultId: vault.id, folderId: feed.folder_id ?? undefined })
      // Filter to only items from this feed
      const feedItems = (items as any[]).filter((i: any) => i.source_feed_id === feed.id)
      set({ items: feedItems, isLoading: false })
    } finally {
      set({ isLoading: false })
    }
  },

  createFeed: async (data) => {
    const vault = get().selectedVault
    if (!vault) throw new Error('No vault selected')
    const feed = await window.api.feeds.create({ ...data, vaultId: vault.id })
    await get().loadFeeds()
    return feed
  },

  updateFeed: async (id, data) => {
    await window.api.feeds.update(id, data)
    await get().loadFeeds()
  },

  deleteFeed: async (id) => {
    const { selectedFeed } = get()
    await window.api.feeds.delete(id)
    if (selectedFeed?.id === id) set({ selectedFeed: null })
    await get().loadFeeds()
  },

  refreshFeed: async (id) => {
    await window.api.feeds.refresh(id)
    await get().loadFeeds()
    const { selectedFeed } = get()
    if (selectedFeed?.id === id) await get().selectFeed(selectedFeed)
  },

  refreshAllFeeds: async () => {
    const vault = get().selectedVault
    if (!vault) return
    await window.api.feeds.refreshAll(vault.id)
    await get().loadFeeds()
  },

  refreshFeedCounts: async () => {
    const vault = get().selectedVault
    if (!vault) return
    const feedUnreadCounts = await window.api.feeds.unreadCounts(vault.id)
    set({ feedUnreadCounts })
  }
}))
