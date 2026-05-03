import { useState, useEffect, useRef } from 'react'
import { Link2, FileText, X, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Vault } from '../types'

export function CaptureWindow() {
  const [vaults,  setVaults]  = useState<Vault[]>([])
  const [vaultId, setVaultId] = useState<number | null>(null)
  const [type,    setType]    = useState<'link' | 'note'>('link')
  const [value,   setValue]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    window.api.vaults.list().then((list) => {
      setVaults(list)
      if (list.length) setVaultId(list[0].id)
    })
    // Focus input when window opens
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleSave = async () => {
    if (!vaultId || !value.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (type === 'link') {
        let url = value.trim()
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url
        await window.api.items.create({ vaultId, type: 'link', url, title: url })
      } else {
        await window.api.items.create({ vaultId, type: 'note', title: value.slice(0, 80), content: value })
      }
      setSaved(true)
      setTimeout(() => window.api.app.closeWindow(), 800)
    } catch (err) {
      setError((err as Error).message ?? 'Failed to save')
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && type === 'link') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') window.api.app.closeWindow()
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && type === 'note') { e.preventDefault(); handleSave() }
  }

  return (
    <div
      className="flex flex-col h-full bg-surface border border-border/80 rounded-xl overflow-hidden select-none"
      onKeyDown={handleKeyDown}
    >
      {/* Drag bar / header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Quick Capture</span>
          {vaults.length > 1 && (
            <select
              value={vaultId ?? ''}
              onChange={(e) => setVaultId(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="bg-card border border-border rounded px-1.5 py-0.5 text-[11px] text-text-secondary focus:outline-none focus:border-gold/50"
            >
              {vaults.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={() => window.api.app.closeWindow()}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="p-1 rounded hover:bg-card text-text-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex border-b border-border/60 shrink-0">
        {(['link', 'note'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setValue(''); setTimeout(() => inputRef.current?.focus(), 50) }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              type === t ? 'text-gold border-b-2 border-gold -mb-px bg-gold/5' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {t === 'link' ? <Link2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            {t === 'link' ? 'URL' : 'Note'}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex-1 p-3">
        {type === 'link' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
        ) : (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your note…"
            rows={4}
            className="w-full resize-none bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
        )}
        {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 shrink-0">
        <p className="text-[10px] text-text-muted">
          {type === 'link' ? 'Enter to save' : '⌘↵ to save · Esc to close'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || saved || !value.trim()}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {saving && !saved && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saved && <CheckCircle2 className="w-3.5 h-3.5" />}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  )
}
