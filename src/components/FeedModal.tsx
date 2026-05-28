import { useState, useEffect } from 'react'
import { X, Rss, Loader2, RefreshCw, FolderPlus } from 'lucide-react'
import { useStore } from '../store'
import type { Feed } from '../types'
import { cn } from '../lib/utils'

const INTERVALS = [
  { label: '15 min',  value: 15 },
  { label: '30 min',  value: 30 },
  { label: '1 hour',  value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 }
]

interface FeedModalProps {
  open:    boolean
  feed?:   Feed | null
  onClose: () => void
}

export function FeedModal({ open, feed, onClose }: FeedModalProps) {
  const { createFeed, updateFeed, selectedVault } = useStore()
  const [url,             setUrl]             = useState('')
  const [title,           setTitle]           = useState('')
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [autoFolder,      setAutoFolder]      = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const isEdit = !!feed

  useEffect(() => {
    if (open) {
      setUrl(feed?.url ?? '')
      setTitle(feed?.title ?? '')
      setIntervalMinutes(feed?.interval_minutes ?? 60)
      setAutoFolder(false)
      setError(null)
    }
  }, [open, feed])

  const handleSave = async () => {
    if (!url.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit && feed) {
        await updateFeed(feed.id, { url: url.trim(), title: title.trim() || undefined, intervalMinutes })
      } else {
        await createFeed({ url: url.trim(), intervalMinutes, autoFolder })
      }
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save feed')
    } finally {
      setSaving(false)
    }
  }

  const handleOpmlImport = async () => {
    if (!selectedVault) return
    const result = await window.api.feeds.importOpml(selectedVault.id)
    if (!result.cancelled) {
      const { loadFeeds } = useStore.getState()
      await loadFeeds()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Rss className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              {isEdit ? 'Edit feed' : 'Add RSS feed'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Feed URL</label>
            <input
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
              className="input w-full"
            />
          </div>

          {isEdit && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">Custom title (optional)</label>
              <input
                type="text"
                placeholder="Leave empty to use feed's own title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input w-full"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted block mb-1.5">Check every</label>
            <div className="flex flex-wrap gap-1.5">
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setIntervalMinutes(i.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    intervalMinutes === i.value
                      ? 'bg-gold/15 text-gold border border-gold/30'
                      : 'bg-card text-text-secondary border border-transparent hover:text-text-primary'
                  )}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setAutoFolder((v) => !v)}
                className={cn(
                  'w-8 h-5 rounded-full transition-colors relative',
                  autoFolder ? 'bg-gold' : 'bg-border'
                )}
              >
                <div className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all', autoFolder ? 'left-4' : 'left-0.5')} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <FolderPlus className="w-3.5 h-3.5" />
                Auto-create folder for this feed
              </div>
            </label>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          {!isEdit && (
            <button
              onClick={handleOpmlImport}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Import OPML
            </button>
          )}
          {isEdit && <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-card transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!url.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save' : 'Add feed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
