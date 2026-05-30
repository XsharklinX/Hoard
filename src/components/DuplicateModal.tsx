import { useEffect, useState } from 'react'
import { X, Trash2, ExternalLink, Loader2, Copy } from 'lucide-react'
import { useStore } from '../store'
import { cn, getDomain, formatRelativeDate } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import type { Item } from '../types'

interface DuplicateModalProps {
  open:    boolean
  onClose: () => void
}

export function DuplicateModal({ open, onClose }: DuplicateModalProps) {
  const { selectedVault, deleteItem, items } = useStore()
  const [groups,   setGroups]   = useState<Array<{ url: string; count: number; ids: number[] }>>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open || !selectedVault) return
    setLoading(true)
    setSelected(new Set())
    window.api.items.duplicates(selectedVault.id)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [open, selectedVault?.id])

  const itemMap = new Map(items.map(i => [i.id, i]))

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectDuplicates = () => {
    // For each group, select all but the newest
    const toSelect = new Set<number>()
    for (const g of groups) {
      const groupItems = g.ids.map(id => itemMap.get(id)).filter(Boolean) as Item[]
      groupItems.sort((a, b) => b.created_at - a.created_at)
      groupItems.slice(1).forEach(i => toSelect.add(i.id))
    }
    setSelected(toSelect)
  }

  const deleteSelected = async () => {
    if (!selected.size) return
    if (!await confirm(`Delete ${selected.size} item${selected.size > 1 ? 's' : ''}?`)) return
    for (const id of selected) await deleteItem(id)
    toast.success(`Deleted ${selected.size} duplicate${selected.size > 1 ? 's' : ''}`)
    setSelected(new Set())
    if (selectedVault) {
      const updated = await window.api.items.duplicates(selectedVault.id)
      setGroups(updated)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Duplicate Detector</h2>
            {!loading && <p className="text-[11px] text-text-muted">{groups.length} groups found</p>}
          </div>
          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <>
                <button onClick={selectDuplicates} className="px-3 py-1.5 text-xs rounded-lg bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                  Select duplicates
                </button>
                {selected.size > 0 && (
                  <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {selected.size}
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Copy className="w-8 h-8 text-text-muted/40" />
              <p className="text-sm text-text-muted">No duplicate URLs found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => {
                const groupItems = group.ids.map(id => itemMap.get(id)).filter(Boolean) as Item[]
                return (
                  <div key={group.url} className="rounded-xl border border-border bg-card/30 overflow-hidden">
                    <div className="px-3 py-2 bg-card/60 border-b border-border/50 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        {group.count} copies
                      </span>
                      <span className="text-[11px] text-text-muted truncate flex-1">{getDomain(group.url)}</span>
                      <button onClick={() => window.api.util.openUrl(group.url)}
                        className="p-0.5 text-text-muted hover:text-sky-400 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {groupItems.map((item, idx) => (
                      <div key={item.id} className={cn(
                        'flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-border/30 transition-colors',
                        selected.has(item.id) ? 'bg-red-500/8' : 'hover:bg-card/40'
                      )}>
                        <input type="checkbox" checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-3.5 h-3.5 accent-red-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{item.title || item.url}</p>
                          <p className="text-[10px] text-text-muted">{formatRelativeDate(item.created_at)} {idx === 0 ? '· newest' : ''}</p>
                        </div>
                        <button onClick={async () => { if (await confirm('Delete this item?')) { await deleteItem(item.id); toast.success('Deleted') } }}
                          className="p-1 text-text-muted hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
