import { useState, useMemo } from 'react'
import { X, Pencil, Trash2, GitMerge, Check, Search } from 'lucide-react'
import { useStore } from '../store'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import type { Tag } from '../types'

const PRESET_COLORS = [
  '#c9952a','#38bdf8','#4ade80','#f87171','#a78bfa',
  '#fb923c','#f472b6','#34d399','#60a5fa','#fbbf24'
]

interface TagManagerModalProps {
  open:    boolean
  onClose: () => void
}

export function TagManagerModal({ open, onClose }: TagManagerModalProps) {
  const { tags, loadTags, deleteTag, items, selectedVault } = useStore()
  const [search,      setSearch]      = useState('')
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [editName,    setEditName]    = useState('')
  const [editColor,   setEditColor]   = useState('')
  const [mergeFrom,   setMergeFrom]   = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)

  const tagCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    items.forEach(item => item.tags.forEach(t => { counts[t.id] = (counts[t.id] ?? 0) + 1 }))
    return counts
  }, [items])

  const filtered = tags.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setMergeFrom(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || saving) return
    setSaving(true)
    try {
      await window.api.tags.update(editingId, editName.trim(), editColor)
      await loadTags()
      setEditingId(null)
      toast.success('Tag updated')
    } finally { setSaving(false) }
  }

  const handleDelete = async (tag: Tag) => {
    if (!await confirm(`Delete tag "${tag.name}"? Items won't be deleted.`)) return
    await deleteTag(tag.id)
    toast.success('Tag deleted')
  }

  const handleMerge = async (intoTag: Tag) => {
    if (!mergeFrom || mergeFrom === intoTag.id) return
    const fromTag = tags.find(t => t.id === mergeFrom)
    if (!fromTag) return
    if (!await confirm(`Merge "${fromTag.name}" into "${intoTag.name}"? All items from "${fromTag.name}" will get "${intoTag.name}" instead.`)) return
    await window.api.tags.merge(mergeFrom, intoTag.id)
    await loadTags()
    setMergeFrom(null)
    toast.success(`Merged "${fromTag.name}" → "${intoTag.name}"`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Manage Tags</h2>
          <div className="flex items-center gap-2">
            {mergeFrom && (
              <span className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
                Pick a tag to merge into ↓
              </span>
            )}
            <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter tags…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-gold/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          <div className="flex flex-col gap-1">
            {filtered.map(tag => {
              const count    = tagCounts[tag.id] ?? 0
              const isEditing = editingId === tag.id
              const isMergeTarget = mergeFrom !== null && mergeFrom !== tag.id

              if (isEditing) {
                return (
                  <div key={tag.id} className="flex flex-col gap-2 p-3 rounded-xl bg-card border border-gold/30">
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                      className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-gold/30" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted">Color:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setEditColor(c)}
                            style={{ background: c }}
                            className={cn('w-4 h-4 rounded-full transition-transform', editColor === c && 'ring-2 ring-white ring-offset-1 ring-offset-card scale-110')} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                      <button onClick={saveEdit} disabled={saving || !editName.trim()}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gold text-black rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors">
                        <Check className="w-3 h-3" />Save
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={tag.id}
                  onClick={isMergeTarget ? () => handleMerge(tag) : undefined}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isMergeTarget ? 'cursor-pointer hover:bg-amber-400/10 border border-dashed border-amber-400/30' : 'hover:bg-card'
                  )}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                  <span className="flex-1 text-sm text-text-secondary">{tag.name}</span>
                  <span className="text-[10px] text-text-muted">{count} items</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(tag)} className="p-1.5 rounded hover:bg-border text-text-muted hover:text-text-primary transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => setMergeFrom(mergeFrom === tag.id ? null : tag.id)}
                      className={cn('p-1.5 rounded transition-colors', mergeFrom === tag.id ? 'text-amber-400 bg-amber-400/10' : 'text-text-muted hover:text-amber-400 hover:bg-border')}>
                      <GitMerge className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(tag)} className="p-1.5 rounded hover:bg-border text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-text-muted text-center py-8">No tags found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
