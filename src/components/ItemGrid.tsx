import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, X, Trash2, MoveRight, CheckSquare, Square, ArrowUpDown, CalendarDays, Download, Tag } from 'lucide-react'
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

interface ItemGridProps {
  onAddItem:   () => void
  onMoveItems: () => void
  onEditItem:  (item: import('../types').Item) => void
}

const CARD_HEIGHT  = 140
const COLS_DEFAULT = 4
const COLS_COMPACT = 5

type SortKey = 'newest' | 'oldest' | 'az' | 'za' | 'pinned'
const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  az:     'A → Z',
  za:     'Z → A',
  pinned: 'Pinned first'
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
    selectedTag, settings, selectedIds, selectAll, clearSelection,
    deleteSelected, selectedType, selectedItem, selectItem, tags
  } = useStore()
  const t = useT()
  const scrollParentRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Local search input state — debounced before hitting store
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debouncedSearch = useDebounce(localSearch, 300)

  // Date filter
  type DateFilter = 'all' | 'week' | 'month' | 'year'
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const DATE_LABELS: Record<DateFilter, string> = {
    all: t.dateFilterAll, week: t.dateFilterWeek, month: t.dateFilterMonth, year: t.dateFilterYear
  }

  const filteredItems = useMemo(() => {
    if (dateFilter === 'all') return items
    const now = Date.now()
    const cutoff = {
      week:  now - 7  * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      year:  now - 365 * 24 * 60 * 60 * 1000,
    }[dateFilter]
    return items.filter((item) => item.created_at * 1000 >= cutoff)
  }, [items, dateFilter])

  useEffect(() => { setSearch(debouncedSearch) }, [debouncedSearch])
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
              <DropdownMenu.Content
                align="end" sideOffset={6}
                className="z-[300] min-w-[150px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden"
              >
                {(Object.entries(DATE_LABELS) as [DateFilter, string][]).map(([key, label]) => (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={() => setDateFilter(key)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none transition-colors',
                      dateFilter === key
                        ? 'text-gold bg-gold/5'
                        : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                  >
                    {label}
                    {dateFilter === key && <span className="text-gold text-[10px]">✓</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
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
          </div>

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

        {/* Grid */}
        <div ref={scrollParentRef} className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <SkeletonGrid compact={settings.compactView} />
          ) : filteredItems.length === 0 ? (
            <EmptyState hasSearch={localSearch.length > 0} onAdd={onAddItem} />
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
      </div>
    </Tooltip.Provider>
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

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      {hasSearch ? (
        <p className="text-text-muted text-sm">{t.noResults}</p>
      ) : (
        <>
          <p className="text-4xl">🐉</p>
          <p className="text-text-secondary text-sm">{t.emptyHoard}</p>
          <button
            onClick={onAdd}
            className="mt-1 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium hover:bg-gold-light transition-colors"
          >
            {t.addFirstItem}
          </button>
        </>
      )}
    </div>
  )
}
