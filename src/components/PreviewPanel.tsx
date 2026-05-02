import React, { useState } from 'react'
import { X, ExternalLink, Pin, Trash2, Clock, Copy, Check, Link as LinkIcon, Archive, Loader2, AlertCircle, Pencil, Files, Download } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import js   from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import ts   from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import py   from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import rs   from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import go   from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import cpp  from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import c    from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import css  from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import sql  from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import md   from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import php  from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin'

SyntaxHighlighter.registerLanguage('javascript', js)
SyntaxHighlighter.registerLanguage('typescript', ts)
SyntaxHighlighter.registerLanguage('python',     py)
SyntaxHighlighter.registerLanguage('rust',       rs)
SyntaxHighlighter.registerLanguage('go',         go)
SyntaxHighlighter.registerLanguage('java',       java)
SyntaxHighlighter.registerLanguage('cpp',        cpp)
SyntaxHighlighter.registerLanguage('c',          c)
SyntaxHighlighter.registerLanguage('html',       html)
SyntaxHighlighter.registerLanguage('css',        css)
SyntaxHighlighter.registerLanguage('sql',        sql)
SyntaxHighlighter.registerLanguage('bash',       bash)
SyntaxHighlighter.registerLanguage('json',       json)
SyntaxHighlighter.registerLanguage('markdown',   md)
SyntaxHighlighter.registerLanguage('yaml',       yaml)
SyntaxHighlighter.registerLanguage('php',        php)
SyntaxHighlighter.registerLanguage('ruby',       ruby)
SyntaxHighlighter.registerLanguage('swift',      swift)
SyntaxHighlighter.registerLanguage('kotlin',     kotlin)
import { useStore } from '../store'
import { useT } from '../i18n'
import { formatDate, cn, toFileUrl, getDomain } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import { NoteEditor } from './NoteEditor'
import { TagSelector } from './TagSelector'
import type { Item } from '../types'

const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  rust: 'Rust', go: 'Go', java: 'Java', cpp: 'C++', c: 'C',
  html: 'HTML', css: 'CSS', sql: 'SQL', bash: 'Bash', json: 'JSON',
  markdown: 'Markdown', yaml: 'YAML', php: 'PHP', ruby: 'Ruby',
  swift: 'Swift', kotlin: 'Kotlin'
}

interface PreviewPanelProps {
  onEdit?: (item: Item) => void
}

export function PreviewPanel({ onEdit }: PreviewPanelProps) {
  const { selectedItem, pinItem, deleteItem, duplicateItem, selectItem, updateItem, settings } = useStore()
  const t = useT()
  const [copied, setCopied]           = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const [imgError,    setImgError]    = useState(false)
  const [isEditing, setIsEditing]     = useState(false)
  const [editContent, setEditContent] = useState('')

  if (!selectedItem) return null
  const item = selectedItem

  React.useEffect(() => {
    setFaviconError(false)
    setImgError(false)
    setIsEditing(false)
  }, [item.id])

  const handleSaveEdit = async (content: string) => {
    if (content !== item.content) await updateItem(item.id, { content })
    setIsEditing(false)
  }

  const handlePin    = async () => {
    await pinItem(item.id, item.is_pinned === 0)
    toast.success(item.is_pinned === 0 ? t.toastItemPinned : t.toastItemUnpinned)
  }
  const handleDelete = async () => {
    if (await confirm(t.deleteItemConfirm)) {
      await deleteItem(item.id)
      toast.success(t.toastItemDeleted)
    }
  }
  const handleCopy   = async () => {
    if (!item.content) return
    await navigator.clipboard.writeText(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <aside className="flex flex-col w-80 shrink-0 border-l border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <TypeBadge type={item.type} lang={item.code_lang} />
          {item.is_pinned === 1 && <Pin className="w-3 h-3 text-gold fill-current" />}
        </div>
        <div className="flex items-center gap-1">
          {item.type === 'image' && (item.image_path || item.url?.startsWith('http')) && (
            <Tip label={t.downloadImage}>
              <button
                onClick={async () => {
                  if (item.image_path) {
                    const r = await window.api.util.exportImage(item.image_path)
                    if (r.success) toast.success(t.toastImageSaved)
                  } else if (item.url) {
                    window.api.util.openUrl(item.url)
                  }
                }}
                className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </Tip>
          )}
          {onEdit && (
            <Tip label={t.editItem}>
              <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-gold transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </Tip>
          )}
          <Tip label={t.duplicateItem}>
            <button onClick={async () => { await duplicateItem(item.id); toast.success(t.toastItemDuplicated) }} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors">
              <Files className="w-3.5 h-3.5" />
            </button>
          </Tip>
          <Tip label={item.is_pinned ? t.unpinItem : t.pinItem}>
            <button onClick={handlePin} className={cn('p-1.5 rounded-lg transition-colors', item.is_pinned ? 'text-gold hover:bg-gold/10' : 'text-text-muted hover:bg-card hover:text-gold')}>
              <Pin className="w-3.5 h-3.5" />
            </button>
          </Tip>
          <Tip label={t.deleteItem}>
            <button onClick={handleDelete} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Tip>
          <Tip label={t.closePreview}>
            <button onClick={() => selectItem(null)} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </Tip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Image preview */}
        {item.type === 'image' && !imgError && (item.image_path || item.url?.startsWith('http')) && (
          <img
            src={item.image_path ? toFileUrl(item.image_path) : item.url!}
            alt={item.title ?? ''}
            loading="lazy"
            className="w-full rounded-xl object-contain max-h-64 bg-card"
            onError={() => setImgError(true)}
          />
        )}

        {/* Title + meta */}
        <div className="flex flex-col gap-1">
          {item.type === 'link' && (
            item.favicon && !faviconError ? (
              <img src={item.favicon} alt="" className="w-5 h-5 rounded-sm mb-1 object-contain bg-white/10" onError={() => setFaviconError(true)} />
            ) : (
              <div className="w-5 h-5 rounded-sm mb-1 flex items-center justify-center bg-blue-400/10 text-blue-400">
                <LinkIcon className="w-3.5 h-3.5" />
              </div>
            )
          )}
          <h2 className="text-sm font-semibold text-text-primary leading-snug">
            {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
          </h2>
          {item.type === 'link' && item.url && <p className="text-[11px] text-text-muted truncate">{getDomain(item.url)}</p>}
          <p className="text-[11px] text-text-muted">{formatDate(item.created_at)}</p>
        </div>

        {/* Reading time */}
        {item.type === 'link' && item.reading_time && settings.showReadingTime && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Clock className="w-3 h-3" />
            {t.readingTimeMin(item.reading_time)}
          </div>
        )}

        {/* Archive status badge */}
        {item.type === 'link' && item.archive_status && (
          <ArchiveBadge status={item.archive_status} />
        )}

        {/* URL */}
        {item.url && (
          <button
            onClick={() => window.api.util.openUrl(item.url!)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs text-blue-400 hover:text-blue-300 hover:border-blue-400/30 transition-colors text-left group"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{item.url}</span>
          </button>
        )}

        {/* Note content — TipTap editor */}
        {item.type === 'note' && (
          <div onDoubleClick={() => { if (!isEditing) { setEditContent(item.content ?? ''); setIsEditing(true) } }}>
            {isEditing ? (
              <NoteEditor
                content={editContent}
                placeholder="Write your note…"
                onBlur={handleSaveEdit}
                onChange={setEditContent}
              />
            ) : (
              <div className="cursor-text hover:bg-white/5 p-1 -m-1 rounded transition-colors" title="Double click to edit">
                <NoteEditor content={item.content ?? ''} readOnly />
              </div>
            )}
          </div>
        )}

        {/* Link description */}
        {item.type === 'link' && item.content && (
          <p className="text-xs text-text-secondary leading-relaxed">{item.content}</p>
        )}

        {/* Code */}
        {item.type === 'code' && item.content && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              {item.code_lang && (
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                  {LANG_LABEL[item.code_lang] ?? item.code_lang}
                </span>
              )}
              <Tip label={copied ? t.codeCopied : t.copyCode}>
                <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-text-muted hover:text-gold transition-colors ml-auto">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? t.codeCopied : t.copyCode}
                </button>
              </Tip>
            </div>
            {isEditing ? (
              <textarea
                autoFocus
                className="w-full h-48 bg-black/40 font-mono text-[11px] text-text-primary p-3 rounded-lg border border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={() => handleSaveEdit(editContent)}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false) }}
              />
            ) : (
              <div
                onDoubleClick={() => { setEditContent(item.content!); setIsEditing(true) }}
                className="rounded-lg overflow-hidden text-[11px] cursor-text ring-1 ring-border/50 hover:ring-gold/30 transition-shadow"
                title="Double click to edit"
              >
                <SyntaxHighlighter language={item.code_lang || 'javascript'} style={vscDarkPlus} customStyle={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)' }} wrapLongLines>
                  {item.content}
                </SyntaxHighlighter>
              </div>
            )}
          </div>
        )}

        {/* Tags — inline editor */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">{t.tagsLabel}</p>
          <TagSelector
            selectedIds={(item.tags ?? []).map((tg) => tg.id)}
            onChange={(ids) => updateItem(item.id, { tagIds: ids })}
          />
        </div>
      </div>

      {/* Open in browser */}
      {item.url && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <button
            onClick={() => window.api.util.openUrl(item.url!)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium hover:bg-gold-light transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t.openInBrowser}
          </button>
        </div>
      )}
    </aside>
  )
}

// ── Archive badge ─────────────────────────────────────────────────────────────
function ArchiveBadge({ status }: { status: Item['archive_status'] }) {
  if (!status) return null
  const config = {
    pending: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Archiving…',  cls: 'text-text-muted' },
    done:    { icon: <Archive  className="w-3 h-3" />,              label: 'Page archived', cls: 'text-emerald-400' },
    failed:  { icon: <AlertCircle className="w-3 h-3" />,           label: 'Archive failed', cls: 'text-amber-500' }
  }[status]
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px]', config.cls)}>
      {config.icon}
      {config.label}
    </div>
  )
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type, lang }: { type: Item['type']; lang: string | null }) {
  const colors: Record<Item['type'], string> = {
    link:  'text-blue-400 bg-blue-400/10',
    note:  'text-emerald-400 bg-emerald-400/10',
    image: 'text-purple-400 bg-purple-400/10',
    code:  'text-amber-400 bg-amber-400/10'
  }
  const labels: Record<Item['type'], string> = {
    link: 'Link', note: 'Note', image: 'Image',
    code: lang ? (LANG_LABEL[lang] ?? lang) : 'Code'
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider', colors[type])}>
      {labels[type]}
    </span>
  )
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom" sideOffset={6}
          className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
