import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Plus, X, Trash2, MoveRight, CheckSquare, Square, ArrowUpDown, CalendarDays, Download, Tag, LayoutGrid, List, Globe, BookOpen, CheckCheck, Clock, Folder as FolderIcon, Link, FileText, Image, Code, Zap, Network, Bookmark, BookmarkPlus } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import Masonry from 'react-masonry-css'
import { useStore } from '../store'
import { useT } from '../i18n'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { ItemCard } from './ItemCard'
import { ItemRow } from './ItemRow'

interface ItemGridProps {
  onAddItem:   () => void
  onMoveItems: () => void
  onEditItem:  (item: import('../types').Item) => void
}

const CARD_HEIGHT  = 140
const COLS_DEFAULT = 4
const COLS_COMPACT = 5

type SortKey = 'newest' | 'oldest' | 'az' | 'za' | 'pinned' | 'readingtime'
const SORT_LABELS: Record<SortKey, string> = {
  newest:      'Newest first',
  oldest:      'Oldest first',
  az:          'A → Z',
  za:          'Z → A',
  pinned:      'Pinned first',
  readingtime: 'Reading time'
}

// ── Debounced search ─────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function ItemGrid({ onAddItem, onMoveItems, onEditItem }: ItemGridProps) {
  const {
    items, searchQuery, setSearch, setSort, sortBy,
    isLoading, selectedVault, selectedFolder,
    selectedTag, settings, updateSettings, selectedIds, selectAll, clearSelection,
    openGraph, addSavedSearch,
    deleteSelected, selectedType, selectedItem, selectItem, tags, bulkSetReadStatus
  } = useStore()
  const t = useT()
  const scrollParentRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Local search input state — debounced before hitting store
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hoard:searchHistory') ?? '[]') } catch { return [] }
  })

  const saveToHistory = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    const next = [trimmed, ...searchHistory.filter((h) => h !== trimmed)].slice(0, 10)
    setSearchHistory(next)
    localStorage.setItem('hoard:searchHistory', JSON.stringify(next))
  }

  // Parse quick-filter tokens from the raw search string
  const quickFilters = useMemo(() => {
    const typeMatch    = /\btype:(\w+)/i.exec(localSearch)
    const domainMatch  = /\bdomain:([\w.-]+)/i.exec(localSearch)
    const tagMatch     = /\btag:([^\s]+)/i.exec(localSearch)
    const beforeMatch  = /\bbefore:([\d-]+)/i.exec(localSearch)
    const afterMatch   = /\bafter:([\d-]+)/i.exec(localSearch)
    const unreadMatch  = /\bunread:(yes|no)/i.exec(localSearch)
    const readMatch    = /\bread:(yes|no)/i.exec(localSearch)
    const archivedMatch = /\barchived:(yes|no)/i.exec(localSearch)
    const deadMatch    = /\bdead:(yes|no)/i.exec(localSearch)
    const pinnedMatch  = /\bpinned:(yes|no)/i.exec(localSearch)
    const hasMatch     = /\bhas:(image|archive|file|url)/i.exec(localSearch)
    const langMatch    = /\blang:(\w+)/i.exec(localSearch)

    const cleanQuery = localSearch
      .replace(/\btype:\w+/gi, '')
      .replace(/\bdomain:[\w.-]+/gi, '')
      .replace(/\btag:[^\s]+/gi, '')
      .replace(/\bbefore:[\d-]+/gi, '')
      .replace(/\bafter:[\d-]+/gi, '')
      .replace(/\bunread:\w+/gi, '')
      .replace(/\bread:\w+/gi, '')
      .replace(/\barchived:\w+/gi, '')
      .replace(/\bdead:\w+/gi, '')
      .replace(/\bpinned:\w+/gi, '')
      .replace(/\bhas:\w+/gi, '')
      .replace(/\blang:\w+/gi, '')
      .trim()

    const dateFrom = beforeMatch ? new Date(beforeMatch[1]).getTime() : null
    const dateTo   = afterMatch  ? new Date(afterMatch[1]).getTime()  : null

    return {
      type:     typeMatch?.[1]  ?? null,
      domain:   domainMatch?.[1] ?? null,
      tag:      tagMatch?.[1]   ?? null,
      lang:     langMatch?.[1]  ?? null,
      dateFrom,
      dateTo,
      unread:   unreadMatch?.[1]?.toLowerCase() === 'yes' ? true : readMatch?.[1]?.toLowerCase() === 'yes' ? false : null,
      archived: archivedMatch ? archivedMatch[1].toLowerCase() === 'yes' : null,
      dead:     deadMatch     ? deadMatch[1].toLowerCase() === 'yes'     : null,
      pinned:   pinnedMatch   ? pinnedMatch[1].toLowerCase() === 'yes'   : null,
      has:      hasMatch?.[1] ?? null,
      cleanQuery
    }
  }, [localSearch])

  const debouncedClean = useDebounce(quickFilters.cleanQuery, 300)

  // Date filter
  type DateFilter = 'all' | 'week' | 'month' | 'year'
  const [dateFilter,    setDateFilter]    = useState<DateFilter>('all')
  const [domainFilter,  setDomainFilter]  = useState<string>('all')
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'pending' | 'done' | 'failed'>('all')

  const DATE_LABELS: Record<DateFilter, string> = {
    all: t.dateFilterAll, week: t.dateFilterWeek, month: t.dateFilterMonth, year: t.dateFilterYear
  }

  // Unique domains from link items
  const availableDomains = useMemo(() => {
    const domains = new Set<string>()
    items.forEach((i) => {
      if (i.type === 'link' && i.url) {
        try { domains.add(new URL(i.url).hostname.replace(/^www\./, '')) } catch { /* skip */ }
      }
    })
    return [...domains].sort()
  }, [items])

  const filteredItems = useMemo(() => {
    let list = items
    if (dateFilter !== 'all') {
      const now = Date.now()
      const cutoff = { week: now - 7*86400000, month: now - 30*86400000, year: now - 365*86400000 }[dateFilter]
      list = list.filter((i) => i.created_at * 1000 >= cutoff)
    }
    if (domainFilter !== 'all') {
      list = list.filter((i) => {
        if (!i.url) return false
        try { return new URL(i.url).hostname.replace(/^www\./, '') === domainFilter } catch { return false }
      })
    }
    if (archiveFilter !== 'all') {
      list = list.filter((i) => i.archive_status === archiveFilter)
    }
    if (quickFilters.type) {
      const qt = quickFilters.type.toLowerCase()
      list = list.filter((i) => i.type === qt)
    }
    if (quickFilters.domain) {
      const qd = quickFilters.domain.toLowerCase()
      list = list.filter((i) => {
        if (!i.url) return false
        try { return new URL(i.url).hostname.replace(/^www\./, '').includes(qd) } catch { return false }
      })
    }
    if (quickFilters.tag) {
      const qt = quickFilters.tag.toLowerCase()
      list = list.filter((i) => i.tags.some((tg) => tg.name.toLowerCase().includes(qt)))
    }
    // Extended operators
    if (quickFilters.lang) {
      list = list.filter((i) => i.code_lang?.toLowerCase() === quickFilters.lang!.toLowerCase())
    }
    if (quickFilters.dateFrom !== null) {
      list = list.filter((i) => i.created_at * 1000 < quickFilters.dateFrom!)
    }
    if (quickFilters.dateTo !== null) {
      list = list.filter((i) => i.created_at * 1000 > quickFilters.dateTo!)
    }
    if (quickFilters.unread !== null) {
      list = list.filter((i) => quickFilters.unread ? i.read_status === 'unread' : i.read_status === 'read')
    }
    if (quickFilters.archived !== null) {
      list = list.filter((i) => quickFilters.archived ? i.archive_status === 'done' : !i.archive_path)
    }
    if (quickFilters.dead !== null) {
      list = list.filter((i) => quickFilters.dead ? i.link_status === 'dead' : i.link_status !== 'dead')
    }
    if (quickFilters.pinned !== null) {
      list = list.filter((i) => quickFilters.pinned ? i.is_pinned === 1 : i.is_pinned === 0)
    }
    if (quickFilters.has) {
      const h = quickFilters.has.toLowerCase()
      if (h === 'image')   list = list.filter((i) => !!i.image_path)
      if (h === 'archive') list = list.filter((i) => i.archive_status === 'done')
      if (h === 'file')    list = list.filter((i) => i.type === 'file' || !!i.file_path)
      if (h === 'url')     list = list.filter((i) => !!i.url)
    }
    return list
  }, [items, dateFilter, domainFilter, archiveFilter, quickFilters])

  // Unread reading time (for banner when selectedType === 'unread')
  const unreadReadingTime = useMemo(() => {
    if (selectedType !== 'unread') return 0
    return filteredItems.reduce((sum, i) => sum + (i.type === 'link' ? (i.reading_time ?? 0) : 0), 0)
  }, [filteredItems, selectedType])

  useEffect(() => { setSearch(debouncedClean) }, [debouncedClean])
  useEffect(() => { setLocalSearch(searchQuery) }, [searchQuery]) // sync on external clear

  const heading = selectedTag
    ? selectedTag.name
    : selectedFolder
    ? selectedFolder.name
    : selectedVault
    ? selectedVault.name
    : t.appName

  const isImageGrid = selectedType === 'image'
  const colCount    = settings.compactView ? COLS_COMPACT : COLS_DEFAULT

  // ── Keyboard navigation in grid ────────────────────────────────────────────
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when grid is focused and no input is active
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') return
      if (!filteredItems.length) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocusedIdx((i) => Math.min(i + 1, filteredItems.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocusedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx((i) => Math.min(i + colCount, filteredItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx((i) => Math.max(i - colCount, 0))
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault()
        selectItem(filteredItems[focusedIdx])
      } else if (e.key === 'Escape') {
        setFocusedIdx(-1)
        selectItem(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items, focusedIdx, colCount, selectItem])

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const url  = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    const file = e.dataTransfer.files?.[0]

    if (file && file.type.startsWith('image/')) {
      const filePath = (file as File & { path: string }).path
      window.api.util.saveImage(filePath).then((savedPath) => {
        useStore.getState().createItem({
          type: 'image', imagePath: savedPath,
          title: file.name.replace(/\.[^.]+$/, ''),
          folderId: useStore.getState().selectedFolder?.id ?? null
        })
      })
      return
    }

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.api.util.fetchMetadata(url).then((meta) => {
        useStore.getState().createItem({
          type: 'link', url, title: meta.title, content: meta.description,
          favicon: meta.favicon, readingTime: meta.readingTime,
          folderId: useStore.getState().selectedFolder?.id ?? null
        })
      })
      return
    }

    if (url) {
      useStore.getState().createItem({ type: 'note', content: url, folderId: useStore.getState().selectedFolder?.id ?? null })
    }
  }, [])

  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [bulkTagIds,  setBulkTagIds]  = useState<Set<number>>(new Set())

  const handleBulkTag = async () => {
    const ids = [...selectedIds]
    await window.api.items.tagSelected(ids, [...bulkTagIds])
    setBulkTagOpen(false)
    setBulkTagIds(new Set())
    toast.success(`Tags updated for ${ids.length} items`)
    clearSelection()
  }

  const handleDeleteSelected = async () => {
    if (await confirm(`Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`)) {
      await deleteSelected()
      toast.success(`Deleted ${selectedIds.size} items`)
    }
  }

  const handleDownloadSelected = async () => {
    const imagesToDownload = items
      .filter(i => selectedIds.has(i.id) && i.image_path)
      .map(i => i.image_path!)
      
    if (imagesToDownload.length === 0) {
      toast.error('No images selected to download')
      return
    }

    const res = await window.api.util.exportImages(imagesToDownload)
    if (res?.success) toast.success(`Downloaded ${res.copied} images`)
  }

  const cols = settings.compactView
    ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]'
    : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'

  const hasBulk = selectedIds.size > 0

  return (
    <Tooltip.Provider delayDuration={600}>
      <div className="flex flex-col flex-1 min-w-0 h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
        {/* Topbar */}
        <header className="flex items-center gap-3 px-6 py-3.5 border-b border-border shrink-0">
          <h1 className="text-base font-semibold text-text-primary truncate mr-auto">
            {heading}
            {searchQuery && (
              <span className="ml-2 text-text-secondary font-normal text-sm">
                — {t.resultsFor} "{searchQuery}"
              </span>
            )}
          </h1>

          {/* Sort dropdown */}
          <DropdownMenu.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <DropdownMenu.Trigger asChild>
                  <button className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                    sortBy !== 'newest'
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'bg-card border-border text-text-muted hover:text-text-primary hover:border-border'
                  )}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                  </button>
                </DropdownMenu.Trigger>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="bottom" sideOffset={6} className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg">
                  Sort items
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end" sideOffset={6}
                className="z-[300] min-w-[160px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden"
              >
                <DropdownMenu.Label className="px-3 py-1 text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                  Sort by
                </DropdownMenu.Label>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={() => setSort(key)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors',
                      sortBy === key
                        ? 'text-gold bg-gold/5'
                        : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                  >
                    {label}
                    {sortBy === key && <span className="text-gold text-[10px]">✓</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Date filter dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                dateFilter !== 'all'
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-card border-border text-text-muted hover:text-text-primary hover:border-border'
              )}>
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{DATE_LABELS[dateFilter]}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="z-[300] min-w-[150px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
                {(Object.entries(DATE_LABELS) as [DateFilter, string][]).map(([key, label]) => (
                  <DropdownMenu.Item key={key} onSelect={() => setDateFilter(key)}
                    className={cn('flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors',
                      dateFilter === key ? 'text-gold bg-gold/5' : 'text-text-secondary hover:bg-card hover:text-text-primary')}>
                    {label}{dateFilter === key && <span className="text-gold text-[10px]">✓</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Domain filter — only when there are link items */}
          {availableDomains.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                  domainFilter !== 'all'
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'bg-card border-border text-text-muted hover:text-text-primary hover:border-border'
                )}>
                  <Globe className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline max-w-[80px] truncate">
                    {domainFilter === 'all' ? 'Domain' : domainFilter}
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[300] min-w-[180px] max-h-64 overflow-y-auto bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
                  <DropdownMenu.Item onSelect={() => setDomainFilter('all')}
                    className={cn('flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors',
                      domainFilter === 'all' ? 'text-gold bg-gold/5' : 'text-text-secondary hover:bg-card hover:text-text-primary')}>
                    All domains{domainFilter === 'all' && <span className="text-gold text-[10px]">✓</span>}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  {availableDomains.map((d) => (
                    <DropdownMenu.Item key={d} onSelect={() => setDomainFilter(d)}
                      className={cn('flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors',
                        domainFilter === d ? 'text-gold bg-gold/5' : 'text-text-secondary hover:bg-card hover:text-text-primary')}>
                      <span className="truncate">{d}</span>
                      {domainFilter === d && <span className="text-gold text-[10px] shrink-0">✓</span>}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Archive status filter */}
          {items.some((i) => i.archive_status) && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                  archiveFilter !== 'all'
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'bg-card border-border text-text-muted hover:text-text-primary hover:border-border'
                )}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline capitalize">{archiveFilter === 'all' ? 'Archive' : archiveFilter}</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[300] min-w-[140px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
                  {(['all', 'done', 'pending', 'failed'] as const).map((v) => (
                    <DropdownMenu.Item key={v} onSelect={() => setArchiveFilter(v)}
                      className={cn('flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors capitalize',
                        archiveFilter === v ? 'text-gold bg-gold/5' : 'text-text-secondary hover:bg-card hover:text-text-primary')}>
                      {v === 'all' ? 'All' : v}{archiveFilter === v && <span className="text-gold text-[10px]">✓</span>}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter' && localSearch.trim()) saveToHistory(localSearch.trim()) }}
              className="w-48 pl-8 pr-7 py-1.5 text-sm rounded-lg bg-card border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
            />
            {localSearch && (
              <button
                onClick={() => { setLocalSearch(''); setSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {searchFocused && !localSearch && searchHistory.length > 0 && (
              <div className="absolute top-full right-0 mt-1 w-56 z-[300] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
                <p className="px-3 py-1 text-[10px] text-text-muted uppercase tracking-widest font-semibold">Recent searches</p>
                {searchHistory.map((h) => (
                  <button
                    key={h}
                    onMouseDown={() => { setLocalSearch(h); saveToHistory(h) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-card hover:text-text-primary transition-colors text-left"
                  >
                    <Clock className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="truncate">{h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save search button — visible when there's an active query */}
          {(localSearch.trim() || quickFilters.unread !== null || quickFilters.archived || quickFilters.dead) && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={async () => {
                    const name = window.prompt('Name for this search:')
                    if (!name?.trim()) return
                    await addSavedSearch({
                      id: Date.now().toString(),
                      name: name.trim(),
                      query: localSearch,
                      filters: {
                        type:        quickFilters.type ?? undefined,
                        domain:      quickFilters.domain ?? undefined,
                        tag:         quickFilters.tag ?? undefined,
                        lang:        quickFilters.lang ?? undefined,
                        readStatus:  quickFilters.unread === true ? 'unread' : quickFilters.unread === false ? 'read' : undefined,
                        hasArchive:  quickFilters.archived ?? undefined,
                        isDead:      quickFilters.dead ?? undefined,
                        isPinned:    quickFilters.pinned ?? undefined
                      }
                    })
                    toast.success(`Saved search "${name.trim()}"`)
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border bg-card border-gold/30 text-gold hover:bg-gold/10 transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="bottom" sideOffset={6} className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg">
                  Save this search
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}

          {/* Graph view button */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={openGraph}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border bg-card border-border text-text-muted hover:text-text-primary hover:border-border transition-colors"
              >
                <Network className="w-3.5 h-3.5" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="bottom" sideOffset={6} className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg">
                Graph view
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* View mode toggle */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => updateSettings({ viewMode: settings.viewMode === 'list' ? 'grid' : 'list' })}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border bg-card border-border text-text-muted hover:text-text-primary hover:border-border transition-colors"
              >
                {settings.viewMode === 'list'
                  ? <LayoutGrid className="w-3.5 h-3.5" />
                  : <List className="w-3.5 h-3.5" />}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="bottom" sideOffset={6} className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg">
                {settings.viewMode === 'list' ? 'Grid view' : 'List view'}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={onAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light active:bg-gold-dim transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t.add}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="bottom" sideOffset={6} className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg">
                Add item <kbd className="ml-1 font-mono">⌘N</kbd>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </header>

        {/* Bulk action bar */}
        {hasBulk && (
          <div className="flex items-center gap-2 px-6 py-2 bg-gold/5 border-b border-gold/20 shrink-0">
            <button
              onClick={() => selectedIds.size === items.length ? clearSelection() : selectAll()}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-gold transition-colors"
            >
              {selectedIds.size === items.length
                ? <CheckSquare className="w-3.5 h-3.5 text-gold" />
                : <Square className="w-3.5 h-3.5" />
              }
              {selectedIds.size === items.length ? 'Deselect all' : 'Select all'}
            </button>

            <span className="text-xs text-text-muted">
              {selectedIds.size} selected
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleDownloadSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              {/* Bulk tag popover */}
              <Popover.Root open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
                <Popover.Trigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                    <Tag className="w-3.5 h-3.5" />
                    Tag
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content side="bottom" align="end" sideOffset={6} className="z-[400] w-52 bg-surface border border-border rounded-xl shadow-2xl p-3 flex flex-col gap-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Apply tags to {selectedIds.size} items</p>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {tags.map((tg) => (
                        <label key={tg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card cursor-pointer text-xs text-text-secondary hover:text-text-primary transition-colors">
                          <input
                            type="checkbox"
                            className="accent-gold w-3.5 h-3.5"
                            checked={bulkTagIds.has(tg.id)}
                            onChange={(e) => {
                              const next = new Set(bulkTagIds)
                              e.target.checked ? next.add(tg.id) : next.delete(tg.id)
                              setBulkTagIds(next)
                            }}
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tg.color }} />
                          {tg.name}
                        </label>
                      ))}
                      {tags.length === 0 && <p className="text-xs text-text-muted px-2">No tags yet</p>}
                    </div>
                    <button
                      onClick={handleBulkTag}
                      className="w-full py-1.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold-light transition-colors"
                    >
                      Apply
                    </button>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <button
                onClick={() => bulkSetReadStatus('read')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark read
              </button>
              <button
                onClick={onMoveItems}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <MoveRight className="w-3.5 h-3.5" />
                Move / Copy
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-card transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Unread reading time banner */}
        {selectedType === 'unread' && unreadReadingTime > 0 && (
          <div className="flex items-center gap-2 px-6 py-2 bg-surface border-b border-border shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-secondary">
              ~{Math.ceil(unreadReadingTime / 60)} min to read
            </span>
            {filteredItems.filter((i) => i.type === 'link').length > 0 && (
              <span className="text-xs text-text-muted">
                · {filteredItems.filter((i) => i.type === 'link').length} articles
              </span>
            )}
          </div>
        )}

        {/* Quick filter chips */}
        {(quickFilters.type || quickFilters.domain || quickFilters.tag) && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-surface border-b border-border/50 shrink-0 flex-wrap">
            <span className="text-[10px] text-text-muted">Filters:</span>
            {quickFilters.type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                type:{quickFilters.type}
              </span>
            )}
            {quickFilters.domain && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-400/10 text-sky-400 border border-sky-400/20">
                domain:{quickFilters.domain}
              </span>
            )}
            {quickFilters.tag && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                tag:{quickFilters.tag}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        {!selectedVault ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-4xl">🏰</p>
            <p className="text-text-secondary text-sm font-medium">No vault selected</p>
            <p className="text-text-muted text-xs">Create or select a vault from the sidebar to get started</p>
          </div>
        ) : settings.viewMode === 'list' ? (
          <div ref={scrollParentRef} className="flex-1 overflow-y-auto">
            {isLoading ? (
              <SkeletonList />
            ) : filteredItems.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  hasSearch={localSearch.length > 0}
                  searchQuery={localSearch}
                  selectedFolder={selectedFolder}
                  selectedTag={selectedTag}
                  selectedType={selectedType}
                  onAdd={onAddItem}
                />
              </div>
            ) : (
              <VirtualList items={filteredItems} scrollRef={scrollParentRef} onMove={onMoveItems} onEdit={onEditItem} />
            )}
          </div>
        ) : (
          <div ref={scrollParentRef} className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <SkeletonGrid compact={settings.compactView} />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                hasSearch={localSearch.length > 0}
                searchQuery={localSearch}
                selectedFolder={selectedFolder}
                selectedTag={selectedTag}
                selectedType={selectedType}
                onAdd={onAddItem}
              />
            ) : (
              <Masonry
                breakpointCols={{ default: colCount, 1400: colCount > 4 ? 4 : colCount, 1100: 3, 700: 2, 500: 1 }}
                className="flex w-auto gap-4"
                columnClassName="bg-clip-padding flex flex-col gap-4"
              >
                {filteredItems.map((item, idx) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    compact={settings.compactView}
                    focused={focusedIdx === idx}
                    onMove={onMoveItems}
                    onEdit={() => onEditItem(item)}
                  />
                ))}
              </Masonry>
            )}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  )
}

// ── Skeleton list ─────────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 animate-pulse"
          style={{ animationDelay: `${i * 30}ms` }}
        >
          <div className="w-5 h-5 rounded-md bg-border/50 shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-2.5 rounded-full bg-border/50 w-48" />
            <div className="h-2 rounded-full bg-border/30 w-28" />
          </div>
          <div className="w-14 h-2 rounded-full bg-border/30 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ── Skeleton loading ──────────────────────────────────────────────────────────
function SkeletonGrid({ compact }: { compact: boolean }) {
  const count = compact ? 15 : 12
  const cols  = compact
    ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]'
    : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'

  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/30 bg-card/30 p-3.5 flex flex-col gap-2.5 animate-pulse"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {/* top row */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-border/50" />
            <div className="h-2.5 rounded-full bg-border/50 w-24" />
          </div>
          {/* title */}
          <div className="h-3 rounded-full bg-border/40 w-full" />
          <div className="h-3 rounded-full bg-border/30 w-3/4" />
          {/* desc */}
          <div className="h-2 rounded-full bg-border/25 w-full mt-1" />
          <div className="h-2 rounded-full bg-border/20 w-5/6" />
        </div>
      ))}
    </div>
  )
}

// ── Virtual list view ─────────────────────────────────────────────────────────
function VirtualList({
  items,
  scrollRef,
  onMove,
  onEdit,
}: {
  items: import('../types').Item[]
  scrollRef: React.RefObject<HTMLDivElement>
  onMove: () => void
  onEdit: (item: import('../types').Item) => void
}) {
  const virtualizer = useVirtualizer({
    count:            items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:     () => 48,
    overscan:         8,
  })

  return (
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map((vRow) => (
        <div
          key={items[vRow.index].id}
          style={{
            position:  'absolute',
            top:       0,
            left:      0,
            width:     '100%',
            transform: `translateY(${vRow.start}px)`,
          }}
        >
          <ItemRow
            item={items[vRow.index]}
            onMove={onMove}
            onEdit={() => onEdit(items[vRow.index])}
          />
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  hasSearch:      boolean
  searchQuery:    string
  selectedFolder: import('../types').Folder | null
  selectedTag:    import('../types').Tag | null
  selectedType:   string
  onAdd:          () => void
}

function EmptyState({ hasSearch, searchQuery, selectedFolder, selectedTag, selectedType, onAdd }: EmptyStateProps) {
  const t = useT()

  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Search className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">No results for "{searchQuery}"</p>
          <p className="text-text-muted text-xs mt-1">Try different keywords or clear the search</p>
        </div>
      </div>
    )
  }

  if (selectedFolder?.smart_query) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-gold" />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">No items match this smart folder yet</p>
          <p className="text-text-muted text-xs mt-1">Items will appear here automatically when they match the rules</p>
        </div>
      </div>
    )
  }

  if (selectedFolder) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
          <FolderIcon className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">This folder is empty</p>
          <p className="text-text-muted text-xs mt-1">Add items here or drag them from another folder</p>
        </div>
        <button onClick={onAdd} className="mt-1 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium hover:bg-gold-light transition-colors">
          Add first item
        </button>
      </div>
    )
  }

  if (selectedTag) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Tag className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">No items tagged "{selectedTag.name}"</p>
          <p className="text-text-muted text-xs mt-1">Tag items using the tag panel in the preview or the bulk-tag button</p>
        </div>
      </div>
    )
  }

  if (selectedType === 'unread') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <p className="text-4xl">✅</p>
        <div>
          <p className="text-text-secondary text-sm font-medium">All caught up!</p>
          <p className="text-text-muted text-xs mt-1">Nothing left to read. Save new links to keep your queue full.</p>
        </div>
      </div>
    )
  }

  const TYPE_EMPTY: Record<string, { icon: React.ElementType; color: string; label: string; hint: string }> = {
    link:  { icon: Link,     color: 'text-sky-400',     label: 'No links saved yet',      hint: 'Save a URL or drag a link here to get started' },
    note:  { icon: FileText, color: 'text-emerald-400', label: 'No notes yet',             hint: 'Create a note to capture your thoughts' },
    image: { icon: Image,    color: 'text-violet-400',  label: 'No images saved yet',      hint: 'Save images or drag image files here' },
    code:  { icon: Code,     color: 'text-amber-400',   label: 'No code snippets yet',     hint: 'Save code snippets with syntax highlighting' },
  }

  const typeEntry = TYPE_EMPTY[selectedType]
  if (typeEntry) {
    const Icon = typeEntry.icon
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
        <div className={cn('w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center', typeEntry.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">{typeEntry.label}</p>
          <p className="text-text-muted text-xs mt-1">{typeEntry.hint}</p>
        </div>
        <button onClick={onAdd} className="mt-1 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium hover:bg-gold-light transition-colors">
          {t.addFirstItem}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
      <p className="text-4xl">🐉</p>
      <p className="text-text-secondary text-sm">{t.emptyHoard}</p>
      <button
        onClick={onAdd}
        className="mt-1 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium hover:bg-gold-light transition-colors"
      >
        {t.addFirstItem}
      </button>
    </div>
  )
}
