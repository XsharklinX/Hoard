import { useState, useRef, useEffect } from 'react'
import { Plus, X, Tag as TagIcon } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { cn } from '../lib/utils'
import type { Tag } from '../types'

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#c9952a', '#14b8a6'
]

interface TagSelectorProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function TagSelector({ selectedIds, onChange }: TagSelectorProps) {
  const { tags, createTag } = useStore()
  const t = useT()
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [newColor, setNewColor] = useState(TAG_COLORS[0])
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = tags.filter((tg) => selectedIds.includes(tg.id))
  const filtered = tags.filter(
    (tg) => !selectedIds.includes(tg.id) && tg.name.toLowerCase().includes(query.toLowerCase())
  )
  const canCreate = query.trim() && !tags.some((tg) => tg.name.toLowerCase() === query.trim().toLowerCase())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (tag: Tag) => {
    const next = selectedIds.includes(tag.id)
      ? selectedIds.filter((id) => id !== tag.id)
      : [...selectedIds, tag.id]
    onChange(next)
  }

  const handleCreate = async () => {
    if (!query.trim() || creating) return
    setCreating(true)
    try {
      const tag = await createTag(query.trim(), newColor)
      onChange([...selectedIds, tag.id])
      setQuery('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Selected tags + input trigger */}
      <div
        className="flex flex-wrap gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-border bg-card cursor-text"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 10) }}
      >
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(tag) }}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          placeholder={selected.length === 0 ? t.addTagPlaceholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-text-primary placeholder-text-muted outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-40 top-full mt-1 left-0 right-0 rounded-xl border border-border bg-surface shadow-xl shadow-black/40 overflow-hidden">
          {/* Existing tags */}
          {filtered.length > 0 && (
            <div className="max-h-32 overflow-y-auto p-1.5 flex flex-col gap-0.5">
              {filtered.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggle(tag)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-card text-left transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-xs text-text-primary">{tag.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Create new */}
          {canCreate && (
            <div className="border-t border-border p-2 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 px-1">
                <TagIcon className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">{t.pickColor}</span>
                <div className="flex gap-1 flex-wrap ml-1">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className="w-3.5 h-3.5 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: newColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '1px'
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className={cn(
                  'flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                  'bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20'
                )}
              >
                <Plus className="w-3 h-3" />
                {t.createTag} "<strong>{query.trim()}</strong>"
                <span className="w-2.5 h-2.5 rounded-full ml-auto" style={{ backgroundColor: newColor }} />
              </button>
            </div>
          )}

          {filtered.length === 0 && !canCreate && (
            <p className="text-xs text-text-muted p-3 text-center">{t.noTags}</p>
          )}
        </div>
      )}
    </div>
  )
}
