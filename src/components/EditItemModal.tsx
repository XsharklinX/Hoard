import { useState, useEffect, useRef } from 'react'
import { Link, FileText, Image, Code, X, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { toast } from '../lib/toast'
import type { Item } from '../types'
import { cn } from '../lib/utils'
import { TagSelector } from './TagSelector'

const CODE_LANGS = [
  'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'cpp', 'c',
  'html', 'css', 'sql', 'bash', 'json', 'markdown', 'yaml', 'php', 'ruby',
  'swift', 'kotlin'
]

interface EditItemModalProps {
  open:    boolean
  item:    Item | null
  onClose: () => void
}

export function EditItemModal({ open, item, onClose }: EditItemModalProps) {
  const { updateItem, folders, selectedVault } = useStore()
  const t = useT()

  const [title,    setTitle]    = useState('')
  const [url,      setUrl]      = useState('')
  const [content,  setContent]  = useState('')
  const [imagePath, setImagePath] = useState('')
  const [codeLang, setCodeLang] = useState('javascript')
  const [folderId, setFolderId] = useState<number | null>(null)
  const [tagIds,   setTagIds]   = useState<number[]>([])
  const [saving,   setSaving]   = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && item) {
      setTitle(item.title ?? '')
      setUrl(item.url ?? '')
      setContent(item.content ?? '')
      setImagePath(item.image_path ?? '')
      setCodeLang(item.code_lang ?? 'javascript')
      setFolderId(item.folder_id)
      setTagIds(item.tags.map((t) => t.id))
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open, item?.id])

  if (!open || !item) return null

  const handlePickImage = async () => {
    const filePath = await window.api.util.openImageDialog()
    if (!filePath) return
    const saved = await window.api.util.saveImage(filePath)
    setImagePath(saved)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateItem(item.id, {
        title:    title.trim() || undefined,
        url:      url.trim() || undefined,
        content:  content.trim() || undefined,
        imagePath: imagePath || undefined,
        codeLang: item.type === 'code' ? codeLang : undefined,
        folderId,
        tagIds
      })
      toast.success(t.toastItemUpdated)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  const TYPE_ICON = { link: Link, note: FileText, image: Image, code: Code }
  const Icon = TYPE_ICON[item.type]

  const vaultFolders = folders.filter((f) => selectedVault && f.vault_id === selectedVault.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKey}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">{t.editItem}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          {/* URL (links only) */}
          {item.type === 'link' && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">URL</label>
              <input
                type="url"
                placeholder={t.urlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Image picker */}
          {item.type === 'image' && (
            <button
              onClick={handlePickImage}
              className={cn(
                'w-full py-6 rounded-xl border-2 border-dashed text-sm transition-colors',
                imagePath
                  ? 'border-gold/40 text-gold'
                  : 'border-border text-text-muted hover:border-gold/30 hover:text-text-secondary'
              )}
            >
              {imagePath ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={`file://${imagePath}`} alt="" className="max-h-24 rounded-lg object-contain" />
                  <span className="text-xs">{t.clickToChange}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Image className="w-5 h-5 mx-auto mb-1" />
                  <span>{t.clickToPickImage}</span>
                </div>
              )}
            </button>
          )}

          {/* Code language */}
          {item.type === 'code' && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{t.codeLanguage}</label>
              <select value={codeLang} onChange={(e) => setCodeLang(e.target.value)} className="input">
                {CODE_LANGS.map((l) => (
                  <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            placeholder={t.titleOptional}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />

          {/* Content */}
          {item.type !== 'image' && (
            <textarea
              placeholder={
                item.type === 'note' ? t.writeNote :
                item.type === 'code' ? t.codePlaceholder :
                t.descriptionOptional
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={item.type === 'note' || item.type === 'code' ? 7 : 3}
              className={cn('input resize-none', (item.type === 'note' || item.type === 'code') && 'font-mono text-xs')}
            />
          )}

          {/* Folder */}
          {vaultFolders.length > 0 && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{t.folders}</label>
              <select
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                className="input"
              >
                <option value="">{t.noParent}</option>
                {vaultFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5">{t.tagsLabel}</label>
            <TagSelector selectedIds={tagIds} onChange={setTagIds} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <span className="text-[10px] text-text-muted">{t.shortcutSave}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-card transition-colors">
              {t.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
