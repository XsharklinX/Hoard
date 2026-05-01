import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'

interface FolderModalProps {
  open: boolean
  onClose: () => void
}

export function FolderModal({ open, onClose }: FolderModalProps) {
  const { createFolder, selectedFolder, folders } = useStore()
  const t = useT()
  const [name,     setName]     = useState('')
  const [parentId, setParentId] = useState<number | undefined>(undefined)
  const [saving,   setSaving]   = useState(false)
  const [isSmart, setIsSmart]   = useState(false)
  const [smartType, setSmartType] = useState('')
  const [smartSearch, setSmartSearch] = useState('')

  useEffect(() => {
    if (open) { 
      setName('')
      setParentId(selectedFolder?.id ?? undefined)
      setIsSmart(false)
      setSmartType('')
      setSmartSearch('')
    }
  }, [open, selectedFolder])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try { 
      let smartQuery = undefined
      if (isSmart && (smartType || smartSearch)) {
        smartQuery = JSON.stringify({
          type: smartType || undefined,
          search: smartSearch || undefined
        })
      }
      await createFolder(name.trim(), isSmart ? undefined : parentId, smartQuery)
      onClose() 
    }
    finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">{t.newFolderTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <input
            type="text"
            placeholder={t.folderNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="input"
          />
          {folders.length > 0 && !isSmart && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{t.parentFolderLabel}</label>
              <select
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                className="input"
              >
                <option value="">{t.noParent}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-text-primary mt-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSmart} 
              onChange={e => setIsSmart(e.target.checked)}
              className="rounded border-border bg-surface text-gold focus:ring-gold/20"
            />
            Make this a Smart Folder
          </label>

          {isSmart && (
            <div className="flex flex-col gap-3 p-3 bg-card rounded-xl border border-border mt-1">
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Filter by Type</label>
                <select value={smartType} onChange={e => setSmartType(e.target.value)} className="input text-sm">
                  <option value="">All Types</option>
                  <option value="link">Links</option>
                  <option value="note">Notes</option>
                  <option value="image">Images</option>
                  <option value="code">Code</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Search Query (optional)</label>
                <input 
                  type="text" 
                  value={smartSearch}
                  onChange={e => setSmartSearch(e.target.value)}
                  placeholder="e.g. Comida, javascript..."
                  className="input text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-card transition-colors">
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light disabled:opacity-50 transition-colors"
          >
            {t.create}
          </button>
        </div>
      </div>
    </div>
  )
}
