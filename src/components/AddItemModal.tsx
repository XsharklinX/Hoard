import { useState, useEffect, useRef } from 'react'
import { Link, FileText, Image, Code, X, Loader2, Plus } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { toast } from '../lib/toast'
import type { ItemType } from '../types'
import { cn } from '../lib/utils'
import { TagSelector } from './TagSelector'

const CODE_LANGS = [
  'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'cpp', 'c',
  'html', 'css', 'sql', 'bash', 'json', 'markdown', 'yaml', 'php', 'ruby',
  'swift', 'kotlin'
]

interface AddItemModalProps {
  open: boolean
  onClose: () => void
  initialType?: ItemType
}

export function AddItemModal({ open, onClose, initialType }: AddItemModalProps) {
  const { createItem, selectedFolder, settings } = useStore()
  const t = useT()

  const [type, setType]         = useState<ItemType>(initialType ?? settings.defaultItemType)
  const [url, setUrl]           = useState('')
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [imagePath, setImagePath] = useState('')
  const [codeLang, setCodeLang] = useState('javascript')
  const [tagIds, setTagIds]     = useState<number[]>([])
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving]     = useState(false)

  const urlRef   = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setType(initialType ?? settings.defaultItemType)
      setUrl(''); setTitle(''); setContent(''); setImagePath(''); setTagIds([])
      setTimeout(() => (type === 'link' ? urlRef : titleRef).current?.focus(), 50)
    }
  }, [open])

  const handleFetchMetadata = async () => {
    if (!url.trim()) return
    setFetching(true)
    try {
      const meta = await window.api.util.fetchMetadata(url.trim())
      if (meta.title && !title)       setTitle(meta.title)
      if (meta.description && !content) setContent(meta.description)
      // For YouTube (and any site returning a thumbnail), store it as image_path
      if (meta.thumbnailPath && !imagePath) setImagePath(meta.thumbnailPath)
    } finally {
      setFetching(false)
    }
  }

  const handlePickImage = async () => {
    const filePath = await window.api.util.openImageDialog()
    if (!filePath) return
    const saved = await window.api.util.saveImage(filePath)
    setImagePath(saved)
    if (!title) setTitle((filePath.split(/[\\/]/).pop() ?? 'Image').replace(/\.[^.]+$/, ''))
  }

  const canSave = () => {
    if (type === 'link')  return url.trim().length > 0
    if (type === 'note')  return content.trim().length > 0 || title.trim().length > 0
    if (type === 'image') return imagePath.length > 0
    if (type === 'code')  return content.trim().length > 0
    return false
  }

  const handleSave = async () => {
    if (!canSave() || saving) return

    // Duplicate URL check
    if (type === 'link' && url.trim()) {
      const normalised = url.trim().toLowerCase().replace(/\/$/, '')
      const duplicate = useStore.getState().items.find(
        (i) => i.url?.toLowerCase().replace(/\/$/, '') === normalised
      )
      if (duplicate) {
        toast.info(t.duplicateUrlWarning)
        // Don't block — let the user decide — just warn and continue
      }
    }

    setSaving(true)
    try {
      await createItem({
        folderId: selectedFolder?.id ?? null,
        type,
        title:    title.trim() || undefined,
        content:  content.trim() || undefined,
        url:      url.trim() || undefined,
        imagePath: imagePath || undefined,
        codeLang: type === 'code' ? codeLang : undefined,
        tagIds
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!open) return null

  const TYPES: { value: ItemType; label: string; Icon: React.ElementType }[] = [
    { value: 'link',  label: t.link,  Icon: Link },
    { value: 'note',  label: t.note,  Icon: FileText },
    { value: 'image', label: t.image, Icon: Image },
    { value: 'code',  label: t.code,  Icon: Code }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKey}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">{t.addToHoard}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1 px-5 pt-4 shrink-0">
          {TYPES.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setType(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                type === value
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-card text-text-secondary hover:text-text-primary border border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable fields */}
        <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          {/* Link URL */}
          {type === 'link' && (
            <div className="flex gap-2">
              <input
                ref={urlRef}
                type="url"
                placeholder={t.urlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleFetchMetadata}
                className="input flex-1"
              />
              <button
                onClick={handleFetchMetadata}
                disabled={!url.trim() || fetching}
                className="px-3 py-2 rounded-lg bg-card border border-border text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
              >
                {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.fetch}
              </button>
            </div>
          )}

          {/* Image picker */}
          {type === 'image' && (
            <button
              onClick={handlePickImage}
              className={cn(
                'w-full py-8 rounded-xl border-2 border-dashed text-sm transition-colors',
                imagePath
                  ? 'border-gold/40 text-gold'
                  : 'border-border text-text-muted hover:border-gold/30 hover:text-text-secondary'
              )}
            >
              {imagePath ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={`file://${imagePath}`} alt="" className="max-h-28 rounded-lg object-contain" />
                  <span className="text-xs">{t.clickToChange}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Image className="w-6 h-6 mx-auto mb-1" />
                  <span>{t.clickToPickImage}</span>
                </div>
              )}
            </button>
          )}

          {/* Code language selector */}
          {type === 'code' && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{t.codeLanguage}</label>
              <select
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                className="input"
              >
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

          {/* Content / note / code */}
          {type !== 'image' && (
            <textarea
              placeholder={
                type === 'note' ? t.writeNote :
                type === 'code' ? t.codePlaceholder :
                t.descriptionOptional
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={type === 'note' || type === 'code' ? 7 : 3}
              className={cn('input resize-none', (type === 'note' || type === 'code') && 'font-mono text-xs')}
            />
          )}

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-muted">{t.tagsLabel}</label>
            </div>
            <TagSelector selectedIds={tagIds} onChange={setTagIds} />
            
            {/* Suggested Tags */}
            {(() => {
              const textToAnalyze = `${title} ${content} ${url}`.toLowerCase()
              const suggested = useStore.getState().tags.filter(
                (tag) => !tagIds.includes(tag.id) && textToAnalyze.includes(tag.name.toLowerCase())
              )
              if (suggested.length === 0) return null
              
              return (
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-text-muted mr-1">Suggested:</span>
                  {suggested.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => setTagIds([...tagIds, tag.id])}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                      style={{ backgroundColor: tag.color }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                      {tag.name}
                    </button>
                  ))}
                </div>
              )
            })()}
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
              disabled={!canSave() || saving}
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
