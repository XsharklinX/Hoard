import { useState } from 'react'
import { Link, FileText, Image, Pin, Trash2, ExternalLink, Clock, Code, Check, Pencil, Copy, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { useStore } from '../store'
import { useT } from '../i18n'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import type { Item } from '../types'
import { cn, formatDate, truncate, toFileUrl, getDomain } from '../lib/utils'

interface ItemCardProps {
  item:      Item
  compact?:  boolean
  focused?:  boolean
  onMove?:   () => void
  onEdit?:   () => void
}

const TYPE_ICON  = { link: Link, note: FileText, image: Image, code: Code }
const TYPE_COLOR = {
  link:  'text-sky-400 bg-sky-400/10',
  note:  'text-emerald-400 bg-emerald-400/10',
  image: 'text-violet-400 bg-violet-400/10',
  code:  'text-amber-400 bg-amber-400/10'
}

export function ItemCard({ item, focused, onMove, onEdit }: ItemCardProps) {
  const { pinItem, deleteItem, duplicateItem, selectItem, selectedItem, settings, selectedIds, toggleSelect } = useStore()
  const t = useT()
  const [faviconError, setFaviconError] = useState(false)
  const [imgError,     setImgError]     = useState(false)

  const isSelected   = selectedItem?.id === item.id
  const isChecked    = selectedIds.has(item.id)
  const hasSelection = selectedIds.size > 0
  const Icon         = TYPE_ICON[item.type]

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) { toggleSelect(item.id); return }
    if (hasSelection) { toggleSelect(item.id); return }
    selectItem(isSelected ? null : item)
  }

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (await confirm(t.deleteItemConfirm)) {
      await deleteItem(item.id)
      toast.success(t.toastItemDeleted)
    }
  }

  const handlePin = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    await pinItem(item.id, item.is_pinned === 0)
    toast.success(item.is_pinned === 0 ? t.toastItemPinned : t.toastItemUnpinned)
  }

  const handleDuplicate = async () => {
    await duplicateItem(item.id)
    toast.success(t.toastItemDuplicated)
  }

  const handleOpenUrl = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (item.url) window.api.util.openUrl(item.url)
  }

  const handleCopyUrl = async () => {
    if (item.url) {
      await navigator.clipboard.writeText(item.url)
      toast.success(t.toastUrlCopied)
    }
  }

  const handleDownloadImage = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!item.image_path) return
    const res = await window.api.util.exportImage(item.image_path)
    if (res.success) toast.success('Image downloaded successfully')
  }

  const showFavicon = item.type === 'link' && item.favicon && !faviconError

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('hoard/item-id', item.id.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const SelectionDot = () => (
    <div
      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
      className={cn(
        'absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
        isChecked
          ? 'bg-gold border-gold'
          : 'bg-background/80 border-border hover:border-gold/60',
        !hasSelection && !isChecked && 'opacity-0 group-hover:opacity-100'
      )}
    >
      {isChecked && <Check className="w-3 h-3 text-black" />}
    </div>
  )

  const menuItemCls = 'flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-card hover:text-text-primary cursor-pointer outline-none transition-colors'

  const contextMenuContent = (
    <ContextMenu.Content className="z-[300] min-w-[160px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
      {item.url && (
        <>
          <ContextMenu.Item className={menuItemCls} onSelect={handleOpenUrl}>
            <ExternalLink className="w-3.5 h-3.5" />{t.openLink}
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemCls} onSelect={handleCopyUrl}>
            <Check className="w-3.5 h-3.5" />{t.copyUrl}
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-border" />
        </>
      )}
      {item.type === 'image' && item.image_path && (
        <>
          <ContextMenu.Item className={menuItemCls} onSelect={() => handleDownloadImage()}>
            <Download className="w-3.5 h-3.5" />Download Image
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-border" />
        </>
      )}
      {onEdit && (
        <ContextMenu.Item className={menuItemCls} onSelect={onEdit}>
          <Pencil className="w-3.5 h-3.5" />{t.editItem}
        </ContextMenu.Item>
      )}
      <ContextMenu.Item className={menuItemCls} onSelect={() => { handleDuplicate() }}>
        <Copy className="w-3.5 h-3.5" />{t.duplicateItem}
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemCls} onSelect={() => handlePin()}>
        <Pin className="w-3.5 h-3.5" />{item.is_pinned ? t.unpinItem : t.pinItem}
      </ContextMenu.Item>
      {onMove && (
        <ContextMenu.Item className={menuItemCls} onSelect={onMove}>
          <FileText className="w-3.5 h-3.5" />{t.moveOrCopy}
        </ContextMenu.Item>
      )}
      <ContextMenu.Separator className="my-1 h-px bg-border" />
      <ContextMenu.Item
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
        onSelect={() => handleDelete()}
      >
        <Trash2 className="w-3.5 h-3.5" />{t.deleteItem}
      </ContextMenu.Item>
    </ContextMenu.Content>
  )

  // ── IMAGE TYPE ────────────────────────────────────────────────────────────
  if (item.type === 'image') {
    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            draggable
            onDragStart={handleDragStart}
            className={cn(
              'group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all',
              focused    && 'ring-2 ring-gold/60 ring-offset-1 ring-offset-background',
              isChecked
                ? 'ring-2 ring-gold ring-offset-1 ring-offset-background'
                : isSelected
                ? 'ring-2 ring-gold ring-offset-2 ring-offset-background'
                : 'hover:opacity-90'
            )}
            onClick={handleClick}
          >
            <SelectionDot />
            <div className="w-full bg-black/20 shrink-0 overflow-hidden relative flex">
              {!imgError && (item.image_path || item.url?.startsWith('http')) ? (
                <img
                  src={item.image_path ? toFileUrl(item.image_path) : item.url!}
                  alt={item.title || 'Image'}
                  loading="lazy"
                  className="w-full h-auto block"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex items-center justify-center w-full aspect-video text-text-muted">
                  <Image className="w-8 h-8 opacity-20" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur p-1 rounded-lg">
                <button onClick={(e) => handleDownloadImage(e)} className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => handlePin(e)} className={cn('p-1.5 rounded-md hover:bg-white/10 transition-colors', item.is_pinned ? 'text-gold' : 'text-white')} title={item.is_pinned ? 'Unpin' : 'Pin'}><Pin className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => handleDelete(e)} className="p-1.5 rounded-md hover:bg-red-500/20 text-white hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </ContextMenu.Trigger>
        {contextMenuContent}
      </ContextMenu.Root>
    )
  }

  // ── NOTE / CODE TYPE ──────────────────────────────────────────────────────
  if (item.type === 'note' || item.type === 'code') {
    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            draggable
            onDragStart={handleDragStart}
            className={cn(
              'group relative flex flex-col p-4 rounded-xl transition-all cursor-pointer border border-transparent',
              focused    && 'ring-2 ring-gold/60',
              isChecked
                ? 'bg-card border-gold/40 ring-1 ring-gold/30'
                : isSelected
                ? 'bg-card border-border shadow-sm'
                : 'hover:bg-card/50 hover:border-border/50'
            )}
            onClick={handleClick}
          >
            <SelectionDot />
            {item.is_pinned === 1 && <Pin className="absolute top-4 right-4 w-3.5 h-3.5 text-gold/70" />}

            {item.title && (
              <h3 className="font-semibold text-text-primary text-base mb-2 pr-6">{item.title}</h3>
            )}

            {item.content && item.type === 'note' && (
              <div className="text-sm text-text-secondary leading-relaxed line-clamp-4">
                {item.content.startsWith('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: item.content }} className="prose prose-invert prose-xs max-w-none" />
                ) : (
                  <ReactMarkdown>{item.content}</ReactMarkdown>
                )}
              </div>
            )}

            {item.content && item.type === 'code' && (
              <pre className="text-xs font-mono text-text-muted bg-black/40 rounded-lg p-3 line-clamp-4 overflow-hidden mt-2 border border-border/50">
                {item.content}
              </pre>
            )}

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3 text-xs text-text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {item.type === 'code' ? item.code_lang || 'Code' : 'Note'}
                </span>
                <span>•</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handlePin(e)} className={cn('p-1.5 rounded-md hover:bg-border transition-colors', item.is_pinned ? 'text-gold' : 'text-text-muted hover:text-gold')}><Pin className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => handleDelete(e)} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </ContextMenu.Trigger>
        {contextMenuContent}
      </ContextMenu.Root>
    )
  }

  // ── LINK TYPE — thumbnail variant ─────────────────────────────────────────
  const hasThumb = !!item.image_path
  const isYouTube = item.url ? /youtube\.com|youtu\.be/.test(item.url) : false

  if (hasThumb) {
    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            draggable
            onDragStart={handleDragStart}
            className={cn(
              'group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all border border-transparent',
              focused    && 'ring-2 ring-gold/60',
              isChecked
                ? 'ring-2 ring-gold ring-offset-1 ring-offset-background border-transparent'
                : isSelected
                ? 'ring-2 ring-gold ring-offset-2 ring-offset-background border-transparent'
                : 'hover:border-border/50'
            )}
            onClick={handleClick}
          >
            <SelectionDot />
            <div className="w-full aspect-video bg-black/30 shrink-0 overflow-hidden relative">
              <img src={toFileUrl(item.image_path!)} alt={item.title || ''} loading="lazy" className="w-full h-full object-cover" />
              {isYouTube && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              )}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur p-1 rounded-lg">
                {item.url && <button onClick={handleOpenUrl} className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"><ExternalLink className="w-3.5 h-3.5" /></button>}
                <button onClick={(e) => handlePin(e)} className={cn('p-1.5 rounded-md hover:bg-white/10 transition-colors', item.is_pinned ? 'text-gold' : 'text-white')}><Pin className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => handleDelete(e)} className="p-1.5 rounded-md hover:bg-red-500/20 text-white hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-card/60">
              {showFavicon ? (
                <img src={item.favicon!} alt="" className="w-4 h-4 object-contain shrink-0" onError={() => setFaviconError(true)} />
              ) : (
                <span className={cn('shrink-0 flex items-center justify-center', TYPE_COLOR[item.type])}><Link className="w-3.5 h-3.5" /></span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-text-primary truncate leading-tight">{item.title || getDomain(item.url || '')}</p>
                <p className="text-xs text-text-muted truncate mt-0.5">{item.url ? getDomain(item.url) : ''}{item.content ? ` · ${truncate(item.content, 40)}` : ''}</p>
              </div>
            </div>
          </div>
        </ContextMenu.Trigger>
        {contextMenuContent}
      </ContextMenu.Root>
    )
  }

  // ── LINK TYPE — standard (no thumbnail) ───────────────────────────────────
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          draggable
          onDragStart={handleDragStart}
          className={cn(
            'group relative flex flex-col p-3.5 rounded-xl transition-all cursor-pointer border',
            focused    && 'ring-2 ring-gold/60',
            isChecked
              ? 'bg-card border-gold/40 ring-1 ring-gold/30'
              : isSelected
              ? 'bg-card border-border shadow-md'
              : 'bg-card/30 border-border/40 hover:bg-card/70 hover:border-border/80'
          )}
          onClick={handleClick}
        >
          <SelectionDot />
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0 w-6 h-6 rounded-md overflow-hidden bg-background border border-border/50 flex items-center justify-center">
                {showFavicon ? (
                  <img src={item.favicon!} alt="" className="w-4 h-4 object-contain" onError={() => setFaviconError(true)} />
                ) : (
                  <span className={cn('flex items-center justify-center w-full h-full', TYPE_COLOR[item.type])}><Link className="w-3 h-3" /></span>
                )}
              </div>
              {item.url && <span className="text-xs text-text-muted truncate font-medium">{getDomain(item.url)}</span>}
              {item.is_pinned === 1 && <Pin className="w-3 h-3 text-gold/70 shrink-0" />}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {item.url && <button onClick={handleOpenUrl} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-sky-400 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></button>}
              <button onClick={(e) => handlePin(e)} className={cn('p-1.5 rounded-md hover:bg-border transition-colors', item.is_pinned ? 'text-gold' : 'text-text-muted hover:text-gold')}><Pin className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => handleDelete(e)} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <p className="font-semibold text-sm text-text-primary leading-snug line-clamp-2 mb-1">
            {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
          </p>

          {item.content && (
            <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mt-0.5">{item.content}</p>
          )}

          {item.reading_time && item.reading_time > 1 && settings.showReadingTime && (
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              <span>{t.readingTimeMin(item.reading_time)}</span>
            </div>
          )}
        </div>
      </ContextMenu.Trigger>
      {contextMenuContent}
    </ContextMenu.Root>
  )
}
