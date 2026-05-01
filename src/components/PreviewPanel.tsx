import React, { useState } from 'react'
import { X, ExternalLink, Pin, Trash2, Clock, Copy, Check, Link as LinkIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore } from '../store'
import { useT } from '../i18n'
import { formatDate, cn, toFileUrl, getDomain } from '../lib/utils'
import type { Item } from '../types'

const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  rust: 'Rust', go: 'Go', java: 'Java', cpp: 'C++', c: 'C',
  html: 'HTML', css: 'CSS', sql: 'SQL', bash: 'Bash', json: 'JSON',
  markdown: 'Markdown', yaml: 'YAML', php: 'PHP', ruby: 'Ruby',
  swift: 'Swift', kotlin: 'Kotlin'
}

export function PreviewPanel() {
  const { selectedItem, pinItem, deleteItem, selectItem, updateItem, settings } = useStore()
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  if (!selectedItem) return null

  const item = selectedItem

  React.useEffect(() => {
    setFaviconError(false)
    setIsEditing(false)
  }, [item.id])

  const handleSaveEdit = async () => {
    if (editContent !== item.content) {
      await updateItem(item.id, { content: editContent })
    }
    setIsEditing(false)
  }
  const handlePin = async () => {
    await pinItem(item.id, item.is_pinned === 0)
  }

  const handleDelete = async () => {
    if (confirm(t.deleteItemConfirm)) {
      await deleteItem(item.id)
    }
  }

  const handleCopy = async () => {
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
          <button
            onClick={handlePin}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              item.is_pinned ? 'text-gold hover:bg-gold/10' : 'text-text-muted hover:bg-card hover:text-gold'
            )}
            title={item.is_pinned ? t.unpinItem : t.pinItem}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-red-400 transition-colors"
            title={t.deleteItem}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => selectItem(null)}
            className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors"
            title={t.closePreview}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Image preview */}
        {item.type === 'image' && item.image_path && (
          <img
            src={toFileUrl(item.image_path)}
            alt={item.title ?? ''}
            className="w-full rounded-xl object-contain max-h-56 bg-border"
          />
        )}

        {/* Title */}
        <div className="flex flex-col gap-1">
          {item.type === 'link' && (
            item.favicon && !faviconError ? (
              <img
                src={item.favicon}
                alt=""
                className="w-5 h-5 rounded-sm mb-1 object-contain bg-white/10"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className="w-5 h-5 rounded-sm mb-1 flex items-center justify-center bg-blue-400/10 text-blue-400">
                <LinkIcon className="w-3.5 h-3.5" />
              </div>
            )
          )}
          <h2 className="text-sm font-semibold text-text-primary leading-snug">
            {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
          </h2>
          {item.type === 'link' && item.url && (
            <p className="text-[11px] text-text-muted truncate">{getDomain(item.url)}</p>
          )}
          <p className="text-[11px] text-text-muted">{formatDate(item.created_at)}</p>
        </div>

        {/* Reading time */}
        {item.type === 'link' && item.reading_time && settings.showReadingTime && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Clock className="w-3 h-3" />
            {t.readingTimeMin(item.reading_time)}
          </div>
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

        {/* Note / description content */}
        {item.type === 'note' && item.content && (
          isEditing ? (
            <textarea
              autoFocus
              className="w-full h-48 bg-black/20 text-xs text-text-primary p-3 rounded-xl border border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false) }}
            />
          ) : (
            <div 
              onDoubleClick={() => { setEditContent(item.content!); setIsEditing(true) }}
              className="prose prose-invert prose-xs max-w-none text-text-secondary text-xs leading-relaxed cursor-text hover:bg-white/5 p-1 -m-1 rounded transition-colors"
              title="Double click to edit"
            >
              <ReactMarkdown>{item.content}</ReactMarkdown>
            </div>
          )
        )}

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
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-text-muted hover:text-gold transition-colors ml-auto"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? t.codeCopied : t.copyCode}
              </button>
            </div>
            {isEditing ? (
              <textarea
                autoFocus
                className="w-full h-48 bg-black/40 font-mono text-[11px] text-text-primary p-3 rounded-lg border border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false) }}
              />
            ) : (
              <div 
                onDoubleClick={() => { setEditContent(item.content!); setIsEditing(true) }}
                className="rounded-lg overflow-hidden text-[11px] cursor-text ring-1 ring-border/50 hover:ring-gold/30 transition-shadow"
                title="Double click to edit"
              >
                <SyntaxHighlighter
                  language={item.code_lang || 'javascript'}
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)' }}
                  wrapLongLines
                >
                  {item.content}
                </SyntaxHighlighter>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
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
