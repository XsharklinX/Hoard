import { useCallback } from 'react'
import { Search, Plus, X } from 'lucide-react'
import Masonry from 'react-masonry-css'
import { useStore } from '../store'
import { useT } from '../i18n'
import { ItemCard } from './ItemCard'

interface ItemGridProps {
  onAddItem: () => void
}

export function ItemGrid({ onAddItem }: ItemGridProps) {
  const { items, searchQuery, setSearch, isLoading, selectedVault, selectedFolder, selectedTag, settings } = useStore()
  const t = useT()

  const heading = selectedTag
    ? selectedTag.name
    : selectedFolder
    ? selectedFolder.name
    : selectedVault
    ? selectedVault.name
    : t.appName

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const url  = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    const file = e.dataTransfer.files?.[0]

    if (file && file.type.startsWith('image/')) {
      // Dropped image file → open as image item after saving
      window.api.util.saveImage(file.path).then((savedPath) => {
        useStore.getState().createItem({
          type: 'image',
          imagePath: savedPath,
          title: file.name.replace(/\.[^.]+$/, ''),
          folderId: useStore.getState().selectedFolder?.id ?? null
        })
      })
      return
    }

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // Dropped URL → create link and fetch metadata
      const vault = useStore.getState().selectedVault
      if (!vault) return
      window.api.util.fetchMetadata(url).then((meta) => {
        useStore.getState().createItem({
          type: 'link',
          url,
          title: meta.title,
          content: meta.description,
          favicon: meta.favicon,
          readingTime: meta.readingTime,
          folderId: useStore.getState().selectedFolder?.id ?? null
        })
      })
      return
    }

    if (url) {
      // Dropped plain text → create note
      useStore.getState().createItem({
        type: 'note',
        content: url,
        folderId: useStore.getState().selectedFolder?.id ?? null
      })
    }
  }, [])

  const cols = settings.compactView
    ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]'
    : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'

  return (
    <div
      className="flex flex-col flex-1 min-w-0 h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 pl-8 pr-7 py-1.5 text-sm rounded-lg bg-card border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light active:bg-gold-dim transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.add}
        </button>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">{t.loading}</div>
        ) : items.length === 0 ? (
          <EmptyState hasSearch={searchQuery.length > 0} onAdd={onAddItem} />
        ) : (
          useStore.getState().selectedType === 'image' ? (
            <Masonry
              breakpointCols={{ default: 4, 1100: 3, 700: 2, 500: 1 }}
              className="flex w-auto gap-4"
              columnClassName="bg-clip-padding flex flex-col gap-4"
            >
              {items.map((item) => (
                <ItemCard key={item.id} item={item} compact={settings.compactView} />
              ))}
            </Masonry>
          ) : (
            <div className={`grid ${cols} gap-3 auto-rows-min`}>
              {items.map((item) => (
                <ItemCard key={item.id} item={item} compact={settings.compactView} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

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
