import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, ExternalLink, Pin, Trash2, Clock, Copy, Check, Link as LinkIcon, Archive, Loader2, AlertCircle, Pencil, Files, Download, BookOpen, Circle, Sparkles, ChevronDown, ChevronUp, Maximize2, History, RotateCcw, Quote, Paperclip, BookOpenText, Network, GitBranch } from 'lucide-react'
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
import { formatDate, formatRelativeDate, formatBytes, cn, toFileUrl, getDomain } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import { NoteEditor } from './NoteEditor'
import { TagSelector } from './TagSelector'
import { CodeEditor } from './CodeEditor'
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
  const { selectedItem, pinItem, deleteItem, duplicateItem, selectItem, selectType, updateItem, settings, setReadStatus, openLightbox } = useStore()
  const autoSummary = useStore(s => s.autoSummaries[s.selectedItem?.id ?? -1])
  const t = useT()
  const [copied, setCopied]           = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const [imgError,    setImgError]    = useState(false)
  const [isEditing, setIsEditing]     = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue,   setTitleValue]   = useState('')
  const [aiSummary,   setAiSummary]   = useState<string | null>(null)
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiError,     setAiError]     = useState<string | null>(null)
  const [aiExpanded,  setAiExpanded]  = useState(true)
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [versions,       setVersions]       = useState<Array<{ id: number; created_at: number }>>([])
  const [saveStatus,     setSaveStatus]     = useState<'idle' | 'saving' | 'saved'>('idle')
  const [readerContent,  setReaderContent]  = useState<{ title: string; content: string } | null>(null)
  const [readerLoading,  setReaderLoading]  = useState(false)
  const [readerMode,     setReaderMode]     = useState(false)
  const [editAttrib,     setEditAttrib]     = useState('')
  const [backlinks,      setBacklinks]      = useState<Item[]>([])
  const [related,        setRelated]        = useState<Item[]>([])
  const [backlinksOpen,  setBacklinksOpen]  = useState(true)
  const [relatedOpen,    setRelatedOpen]    = useState(true)
  const editCountRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!selectedItem) return null
  const item = selectedItem

  const wordCount = item.type === 'note' && item.content
    ? item.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length
    : 0

  React.useEffect(() => {
    setFaviconError(false)
    setImgError(false)
    setIsEditing(false)
    setEditingTitle(false)
    setAiSummary(null)
    setAiError(null)
    setHistoryOpen(false)
    setSaveStatus('idle')
    setReaderContent(null)
    setReaderMode(false)
    setBacklinks([])
    setRelated([])
    editCountRef.current = 0
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    // Fetch backlinks + related in background
    window.api.items.backlinks(item.id).then(setBacklinks).catch(() => {})
    window.api.items.related(item.id).then(setRelated).catch(() => {})
  }, [item.id])

  React.useEffect(() => {
    if (autoSummary) { setAiSummary(autoSummary); setAiExpanded(true) }
  }, [autoSummary])

  const handleSummarize = async () => {
    if (aiLoading) return
    setAiLoading(true)
    setAiError(null)
    const text = item.content ?? item.title ?? item.url ?? ''
    const result = await window.api.ai.summarize({
      text,
      provider:      settings.aiProvider,
      ollamaUrl:     settings.aiOllamaUrl,
      ollamaModel:   settings.aiOllamaModel,
      claudeApiKey:  settings.aiClaudeApiKey,
      geminiApiKey:  settings.aiGeminiApiKey
    })
    setAiLoading(false)
    if (result.error) setAiError(result.error)
    else { setAiSummary(result.summary ?? ''); setAiExpanded(true) }
  }

  const handleMentionClick = async (id: number) => {
    let target = useStore.getState().items.find(i => i.id === id)
    if (!target) {
      await selectType('all')
      target = useStore.getState().items.find(i => i.id === id)
    }
    if (target) selectItem(target)
    else toast.info('Item not found in current vault')
  }

  const handleNoteChange = (content: string) => {
    setEditContent(content)
    if (content === item.content) return
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      editCountRef.current++
      if (editCountRef.current % 10 === 0) {
        window.api.items.versionSave(item.id, item.content ?? '').catch(console.error)
      }
      await updateItem(item.id, { content })
      setSaveStatus('saved')
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }

  const handleSaveEdit = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('idle')
    setIsEditing(false)
  }

  const handleOpenHistory = useCallback(async () => {
    const list = await window.api.items.versionsList(item.id)
    setVersions(list)
    setHistoryOpen(true)
  }, [item.id])

  const handleRestoreVersion = useCallback(async (versionId: number) => {
    const v = await window.api.items.versionGet(versionId)
    if (!v) return
    await updateItem(item.id, { content: v.content })
    setHistoryOpen(false)
    toast.success('Version restored')
  }, [item.id, updateItem])

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

  const handleReaderMode = async () => {
    if (readerMode) { setReaderMode(false); return }
    if (readerContent) { setReaderMode(true); return }
    if (!item.archive_path) return
    setReaderLoading(true)
    const result = await window.api.util.extractReader(item.archive_path)
    setReaderLoading(false)
    if (result) { setReaderContent(result); setReaderMode(true) }
    else toast.error('Could not extract readable content from archive')
  }

  return (
    <aside className="relative flex flex-col w-80 shrink-0 border-l border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <TypeBadge type={item.type} lang={item.code_lang} />
          {item.is_pinned === 1 && <Pin className="w-3 h-3 text-gold fill-current" />}
        </div>
        <div className="flex items-center gap-1">
          {/* Read status toggle */}
          <Tip label={item.read_status === 'unread' ? 'Mark as read' : 'Mark as unread'}>
            <button
              onClick={() => setReadStatus(item.id, item.read_status === 'unread' ? 'read' : 'unread')}
              className={cn('p-1.5 rounded-lg transition-colors', item.read_status === 'unread' ? 'text-sky-400 hover:bg-sky-400/10' : 'text-text-muted hover:bg-card hover:text-sky-400')}
            >
              <Circle className={cn('w-3.5 h-3.5', item.read_status === 'unread' && 'fill-sky-400/40')} />
            </button>
          </Tip>
          {/* AI summarize button */}
          {settings.aiProvider !== 'none' && (
            <Tip label="Summarize with AI">
              <button
                onClick={handleSummarize}
                disabled={aiLoading}
                className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-gold transition-colors disabled:opacity-50"
              >
                {aiLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
              </button>
            </Tip>
          )}
          {/* Reader mode — inline readability for archived links */}
          {item.type === 'link' && item.archive_status === 'done' && item.archive_path && (
            <>
              <Tip label={readerMode ? 'Exit reader' : 'Reader mode'}>
                <button
                  onClick={handleReaderMode}
                  disabled={readerLoading}
                  className={cn('p-1.5 rounded-lg transition-colors', readerMode ? 'text-emerald-400 bg-emerald-400/10' : 'text-text-muted hover:bg-card hover:text-emerald-400')}
                >
                  {readerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpenText className="w-3.5 h-3.5" />}
                </button>
              </Tip>
              <Tip label="Open archive">
                <button
                  onClick={() => window.api.items.openReader(item.archive_path!, item.title || 'Article')}
                  className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-sky-400 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              </Tip>
            </>
          )}
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
          {item.type === 'note' && (
            <Tip label="Version history">
              <button onClick={handleOpenHistory} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors">
                <History className="w-3.5 h-3.5" />
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

      {/* Version history drawer */}
      {historyOpen && (
        <div className="absolute inset-0 z-20 bg-surface flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text-primary">Version History</span>
            <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {versions.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">No saved snapshots yet.<br />Snapshots are saved every 10 edits.</p>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border hover:border-gold/30 group transition-colors">
                  <span className="text-xs text-text-secondary">{new Date(v.created_at * 1000).toLocaleString()}</span>
                  <button
                    onClick={() => handleRestoreVersion(v.id)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <RotateCcw className="w-3 h-3" />Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Image preview */}
        {item.type === 'image' && !imgError && (item.image_path || item.url?.startsWith('http')) && (
          <div className="relative group cursor-zoom-in" onClick={() => openLightbox(item)}>
            <img
              src={item.image_path ? toFileUrl(item.image_path) : item.url!}
              alt={item.title ?? ''}
              loading="lazy"
              className="w-full rounded-xl object-contain max-h-64 bg-card"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl">
              <Maximize2 className="w-6 h-6 text-white drop-shadow" />
            </div>
          </div>
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
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={async () => {
                const val = titleValue.trim()
                if (val && val !== item.title) await updateItem(item.id, { title: val })
                setEditingTitle(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              className="w-full text-sm font-semibold text-text-primary bg-card border border-gold/40 rounded-md px-2 py-0.5 outline-none focus:ring-1 focus:ring-gold/30"
            />
          ) : (
            <h2
              className="text-sm font-semibold text-text-primary leading-snug cursor-text hover:text-gold transition-colors"
              onDoubleClick={() => { setTitleValue(item.title ?? ''); setEditingTitle(true) }}
              title="Double-click to edit title"
            >
              {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
            </h2>
          )}
          {item.type === 'link' && item.url && <p className="text-[11px] text-text-muted truncate">{getDomain(item.url)}</p>}
          <p className="text-[11px] text-text-muted">{formatRelativeDate(item.created_at)}</p>
        </div>

        {/* Reading time */}
        {item.type === 'link' && item.reading_time && settings.showReadingTime && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Clock className="w-3 h-3" />
            {t.readingTimeMin(item.reading_time)}
          </div>
        )}

        {/* AI summary */}
        {(aiSummary || aiError) && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-gold/20 bg-gold/5 p-3">
            <button
              onClick={() => setAiExpanded(v => !v)}
              className="flex items-center justify-between gap-2 text-[10px] text-gold font-semibold uppercase tracking-widest"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />AI Summary
              </span>
              {aiExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {aiExpanded && (
              aiError
                ? <p className="text-xs text-red-400">{aiError}</p>
                : <p className="text-xs text-text-secondary leading-relaxed">{aiSummary}</p>
            )}
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
              <div className="flex flex-col gap-1">
                <NoteEditor
                  content={editContent}
                  placeholder="Write your note…"
                  onBlur={handleSaveEdit}
                  onChange={handleNoteChange}
                />
                {saveStatus !== 'idle' && (
                  <p className={cn(
                    'text-[10px] text-right transition-opacity',
                    saveStatus === 'saving' ? 'text-text-muted' : 'text-emerald-400'
                  )}>
                    {saveStatus === 'saving' ? 'saving…' : '✓ saved'}
                  </p>
                )}
              </div>
            ) : (
              <div className="cursor-text hover:bg-white/5 p-1 -m-1 rounded transition-colors" title="Double click to edit">
                <NoteEditor content={item.content ?? ''} readOnly onMentionClick={handleMentionClick} />
                {wordCount > 0 && (
                  <p className="text-[10px] text-text-muted mt-1.5 text-right">{wordCount} words</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Link description */}
        {item.type === 'link' && item.content && (
          <p className="text-xs text-text-secondary leading-relaxed">{item.content}</p>
        )}

        {/* Reader mode content */}
        {item.type === 'link' && readerMode && readerContent && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <BookOpenText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Reader mode</span>
            </div>
            <div
              className="prose prose-invert prose-xs max-w-none text-sm leading-relaxed reader-content"
              dangerouslySetInnerHTML={{ __html: readerContent.content }}
            />
          </div>
        )}

        {/* Quote content */}
        {item.type === 'quote' && (
          <div className="flex flex-col gap-3">
            <div className="relative pl-4 border-l-2 border-pink-400/50">
              <Quote className="absolute -left-1 -top-1 w-4 h-4 text-pink-400/40" />
              {isEditing ? (
                <textarea
                  autoFocus
                  className="w-full bg-transparent text-sm italic text-text-primary outline-none resize-none leading-relaxed"
                  value={editContent}
                  rows={4}
                  onChange={(e) => setEditContent(e.target.value)}
                  onBlur={async () => { await updateItem(item.id, { content: editContent }); setIsEditing(false) }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false) }}
                />
              ) : (
                <p
                  className="text-sm italic text-text-primary leading-relaxed cursor-text hover:text-gold/90 transition-colors"
                  onDoubleClick={() => { setEditContent(item.content ?? ''); setIsEditing(true) }}
                  title="Double click to edit"
                >
                  {item.content}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editAttrib !== '' || item.attribution ? (
                <input
                  className="flex-1 text-xs text-text-muted bg-transparent border-b border-border/50 outline-none py-0.5 placeholder-text-muted/50 focus:border-gold/40"
                  placeholder="— Attribution"
                  defaultValue={item.attribution ?? ''}
                  onBlur={async (e) => {
                    await updateItem(item.id, { attribution: e.target.value })
                    setEditAttrib('')
                  }}
                />
              ) : (
                <button
                  onClick={() => setEditAttrib('editing')}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  {item.attribution ? `— ${item.attribution}` : '+ Add attribution'}
                </button>
              )}
            </div>
            {item.url && (
              <button
                onClick={() => window.api.util.openUrl(item.url!)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs text-blue-400 hover:text-blue-300 hover:border-blue-400/30 transition-colors text-left"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.url}</span>
              </button>
            )}
          </div>
        )}

        {/* File content */}
        {item.type === 'file' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-xl bg-orange-400/10 border border-orange-400/20 flex items-center justify-center shrink-0">
                <Paperclip className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{item.title || 'File'}</p>
                {item.file_mime && <p className="text-xs text-text-muted">{item.file_mime}</p>}
                {item.file_size && <p className="text-xs text-text-muted">{formatBytes(item.file_size)}</p>}
              </div>
            </div>
            {item.file_path && (
              <button
                onClick={() => window.api.util.openFile(item.file_path!)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-400/10 border border-orange-400/20 text-orange-400 text-sm font-medium hover:bg-orange-400/20 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open with system
              </button>
            )}
          </div>
        )}

        {/* Code */}
        {item.type === 'code' && item.content && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.code_lang && (
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                    {LANG_LABEL[item.code_lang] ?? item.code_lang}
                  </span>
                )}
                <span className="text-[10px] text-text-muted/60">
                  {item.content.split('\n').length} lines
                </span>
              </div>
              <Tip label={copied ? t.codeCopied : t.copyCode}>
                <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-text-muted hover:text-gold transition-colors ml-auto">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? t.codeCopied : t.copyCode}
                </button>
              </Tip>
            </div>
            <div
              onDoubleClick={() => { if (!isEditing) { setEditContent(item.content!); setIsEditing(true) } }}
              className={cn('rounded-lg overflow-hidden text-[11px] cursor-text ring-1 transition-shadow', isEditing ? 'ring-gold/50' : 'ring-border/50 hover:ring-gold/30')}
              title={isEditing ? '' : 'Double click to edit'}
            >
              <CodeEditor
                value={isEditing ? editContent : item.content}
                onChange={isEditing ? setEditContent : undefined}
                language={item.code_lang}
                readOnly={!isEditing}
                minHeight="160px"
              />
            </div>
            {isEditing && (
              <div className="flex items-center justify-end gap-2 text-[10px]">
                <button onClick={() => setIsEditing(false)} className="text-text-muted hover:text-text-secondary transition-colors">Cancel</button>
                <button
                  onClick={async () => { await updateItem(item.id, { content: editContent }); setIsEditing(false) }}
                  className="text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div>
            <button
              onClick={() => setBacklinksOpen((v) => !v)}
              className="flex items-center justify-between w-full text-[10px] text-text-muted uppercase tracking-widest mb-1.5 hover:text-text-secondary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" />
                Backlinks ({backlinks.length})
              </span>
              {backlinksOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {backlinksOpen && (
              <div className="flex flex-col gap-0.5">
                {backlinks.map((bl) => (
                  <button
                    key={bl.id}
                    onClick={() => selectItem(bl)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-card hover:text-text-primary transition-colors text-left"
                  >
                    <LinkIcon className="w-3 h-3 shrink-0 text-sky-400/60" />
                    <span className="truncate">{bl.title ?? `Item #${bl.id}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Related items */}
        {related.length > 0 && (
          <div>
            <button
              onClick={() => setRelatedOpen((v) => !v)}
              className="flex items-center justify-between w-full text-[10px] text-text-muted uppercase tracking-widest mb-1.5 hover:text-text-secondary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Network className="w-3 h-3" />
                Related ({related.length})
              </span>
              {relatedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {relatedOpen && (
              <div className="flex flex-col gap-0.5">
                {related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectItem(r)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-card hover:text-text-primary transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400/60" />
                    <span className="truncate">{r.title ?? `Item #${r.id}`}</span>
                    {r.tags.length > 0 && (
                      <span className="ml-auto text-[10px] text-text-muted shrink-0">{r.tags.slice(0,2).map(t => t.name).join(', ')}</span>
                    )}
                  </button>
                ))}
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
    code:  'text-amber-400 bg-amber-400/10',
    quote: 'text-pink-400 bg-pink-400/10',
    file:  'text-orange-400 bg-orange-400/10'
  }
  const labels: Record<Item['type'], string> = {
    link:  'Link',
    note:  'Note',
    image: 'Image',
    code:  lang ? (LANG_LABEL[lang] ?? lang) : 'Code',
    quote: 'Quote',
    file:  'File'
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
