import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Link, FileText, Image, Code, X } from 'lucide-react'
import { useStore } from '../store'
import { toFileUrl, getDomain } from '../lib/utils'
import type { Item } from '../types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

const TYPE_ICON: Record<string, React.ElementType> = {
  link: Link, note: FileText, image: Image, code: Code
}
const TYPE_COLOR: Record<string, string> = {
  link: 'text-sky-400', note: 'text-emerald-400', image: 'text-purple-400', code: 'text-amber-400'
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { items, selectItem } = useStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset & focus on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const filtered = (items || []).filter((item) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      item.title?.toLowerCase().includes(q) ||
      item.content?.toLowerCase().includes(q) ||
      item.url?.toLowerCase().includes(q)
    )
  }).slice(0, 15)

  const handleSelect = (item: Item) => {
    selectItem(item)
    onClose()
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex])
    }
  }, [filtered, selectedIndex, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl glass-surface rounded-2xl animate-pop-in overflow-hidden flex flex-col shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search your digital hoard…"
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-card border border-border text-text-muted">ESC</kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[60vh] py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-text-muted text-sm">
              {query ? 'No items found matching your search' : 'No items in this vault yet'}
            </div>
          ) : (
            <>
              {!query && (
                <p className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-text-muted font-bold opacity-70">
                  Recently added
                </p>
              )}
              {filtered.map((item, idx) => {
                const Icon = TYPE_ICON[item.type] ?? Link
                const colorClass = TYPE_COLOR[item.type] ?? 'text-sky-400'
                const isSelected = idx === selectedIndex

                return (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left",
                      isSelected ? "bg-gold/10" : "hover:bg-card/40"
                    )}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item)}
                  >
                    {/* Icon / thumbnail */}
                    <div className={cn(
                      "shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden",
                      isSelected ? "border-gold/30" : "border-border/60 bg-card"
                    )}>
                      {item.type === 'image' && item.image_path ? (
                        <img src={toFileUrl(item.image_path)} className="w-full h-full object-cover" alt="" />
                      ) : item.type === 'link' && item.favicon ? (
                        <img src={item.favicon} className="w-4 h-4 object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <Icon className={cn("w-4 h-4", colorClass)} />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-gold" : "text-text-primary"
                      )}>
                        {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
                      </p>
                      {item.url ? (
                        <p className="text-[11px] text-text-muted truncate opacity-80">{getDomain(item.url)}</p>
                      ) : item.content ? (
                        <p className="text-[11px] text-text-muted truncate opacity-80">{item.content.slice(0, 80)}</p>
                      ) : null}
                    </div>

                    {/* Type badge */}
                    <span className={cn(
                      "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0",
                      isSelected ? "bg-gold/20 border-gold/40 text-gold" : "bg-card/80 border-border/50 text-text-muted"
                    )}>
                      {item.type}
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/40 flex items-center gap-4 text-[10px] text-text-muted bg-card/20">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card font-mono text-[9px]">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card font-mono text-[9px]">↵</kbd>
            <span>Open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card font-mono text-[9px]">ESC</kbd>
            <span>Close</span>
          </div>
          <div className="ml-auto opacity-60">
            {filtered.length} items shown
          </div>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
