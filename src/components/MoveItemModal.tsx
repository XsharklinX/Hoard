import { useState } from 'react'
import { X, MoveRight, Copy, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'

interface MoveItemModalProps {
  open: boolean
  onClose: () => void
}

export function MoveItemModal({ open, onClose }: MoveItemModalProps) {
  const { vaults, folders, selectedVault, selectedIds, moveSelected, copyItem, selectedItem } = useStore()
  const [targetVaultId, setTargetVaultId]   = useState<number | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null)
  const [mode, setMode]   = useState<'move' | 'copy'>('move')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const isBulk     = selectedIds.size > 0
  const itemCount  = isBulk ? selectedIds.size : 1
  const activeVaultId = targetVaultId ?? selectedVault?.id ?? null
  const vaultFolders  = folders.filter((f) => f.vault_id === activeVaultId && f.parent_id === null && !f.smart_query)

  const handleConfirm = async () => {
    if (!activeVaultId) return
    setLoading(true)
    try {
      if (isBulk) {
        if (mode === 'move') await moveSelected(activeVaultId, targetFolderId)
        else {
          // bulk copy: copy each selected item
          for (const id of selectedIds) await copyItem(id, activeVaultId, targetFolderId)
        }
      } else if (selectedItem) {
        if (mode === 'move') {
          await useStore.getState().moveItem(selectedItem.id, activeVaultId, targetFolderId)
        } else {
          await copyItem(selectedItem.id, activeVaultId, targetFolderId)
        }
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {mode === 'move' ? 'Move' : 'Copy'} {itemCount} item{itemCount > 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['move', 'copy'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                  mode === m ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary'
                )}
              >
                {m === 'move' ? <MoveRight className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {m === 'move' ? 'Move' : 'Copy'}
              </button>
            ))}
          </div>

          {/* Vault selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Vault</label>
            <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {vaults.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setTargetVaultId(v.id); setTargetFolderId(null) }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    activeVaultId === v.id
                      ? 'bg-gold/10 text-gold'
                      : 'hover:bg-card text-text-secondary hover:text-text-primary'
                  )}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                  {v.name}
                  {v.id === selectedVault?.id && (
                    <span className="ml-auto text-[10px] text-text-muted">current</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Folder selector */}
          {vaultFolders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                Folder <span className="normal-case font-normal">(optional)</span>
              </label>
              <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                <button
                  onClick={() => setTargetFolderId(null)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    targetFolderId === null
                      ? 'bg-gold/10 text-gold'
                      : 'hover:bg-card text-text-secondary hover:text-text-primary'
                  )}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  No folder (vault root)
                </button>
                {vaultFolders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTargetFolderId(f.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                      targetFolderId === f.id
                        ? 'bg-gold/10 text-gold'
                        : 'hover:bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-card border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !activeVaultId}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light transition-colors disabled:opacity-40"
          >
            {loading ? 'Working…' : mode === 'move' ? 'Move here' : 'Copy here'}
          </button>
        </div>
      </div>
    </div>
  )
}
