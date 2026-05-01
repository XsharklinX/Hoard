import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { Vault } from '../types'

const COLORS = [
  '#c9952a', '#ef4444', '#3b82f6', '#22c55e',
  '#8b5cf6', '#f97316', '#06b6d4', '#eab308'
]

interface VaultModalProps {
  open: boolean
  vault?: Vault | null
  onClose: () => void
}

export function VaultModal({ open, vault, onClose }: VaultModalProps) {
  const { createVault, updateVault } = useStore()
  const t = useT()
  const [name,   setName]   = useState('')
  const [color,  setColor]  = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setName(vault?.name ?? ''); setColor(vault?.color ?? COLORS[0]) }
  }, [open, vault])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      vault ? await updateVault(vault.id, name.trim(), color) : await createVault(name.trim(), color)
      onClose()
    } finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {vault ? t.editVaultTitle : t.newVaultTitle}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <input
            type="text"
            placeholder={t.vaultNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="input"
          />
          <div>
            <p className="text-xs text-text-muted mb-2">{t.color}</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>
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
            {vault ? t.save : t.create}
          </button>
        </div>
      </div>
    </div>
  )
}
