import { useState } from 'react'
import { Link, FileText, Image, Pin, Trash2, ExternalLink, Clock, Code } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { Item } from '../types'
import { cn, formatDate, truncate, toFileUrl, getDomain } from '../lib/utils'

interface ItemCardProps {
  item: Item
  compact?: boolean
}

const TYPE_ICON  = { link: Link, note: FileText, image: Image, code: Code }
const TYPE_COLOR = {
  link:  'text-sky-400 bg-sky-400/10',
  note:  'text-emerald-400 bg-emerald-400/10',
  image: 'text-violet-400 bg-violet-400/10',
  code:  'text-amber-400 bg-amber-400/10'
}

export function ItemCard({ item, compact }: ItemCardProps) {
  const { pinItem, deleteItem, selectItem, selectedItem, settings } = useStore()
  const t = useT()
  const [faviconError, setFaviconError] = useState(false)

  const isSelected = selectedItem?.id === item.id
  const Icon = TYPE_ICON[item.type]

  const handleSelect    = () => selectItem(isSelected ? null : item)
  const handleDelete    = async (e: React.MouseEvent) => { e.stopPropagation(); if (confirm(t.deleteItemConfirm)) await deleteItem(item.id) }
  const handlePin       = async (e: React.MouseEvent) => { e.stopPropagation(); await pinItem(item.id, item.is_pinned === 0) }
  const handleOpenUrl   = (e: React.MouseEvent) => { e.stopPropagation(); if (item.url) window.api.util.openUrl(item.url) }

  const showFavicon = item.type === 'link' && item.favicon && !faviconError

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('hoard/item-id', item.id.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  // IMAGE TYPE
  if (item.type === 'image') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className={cn(
          'group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all',
          isSelected ? 'ring-2 ring-gold ring-offset-2 ring-offset-background' : 'hover:opacity-90'
        )}
        onClick={handleSelect}
      >
        <div className="w-full aspect-video bg-black/20 shrink-0 overflow-hidden relative">
          {item.image_path ? (
            <img
              src={toFileUrl(item.image_path)}
              alt={item.title || 'Image'}
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.currentTarget
                el.style.display = 'none'
                el.parentElement!.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-text-muted text-xs gap-2"><Image class="w-6 h-6 opacity-50" />Image not found</div>'
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <Image className="w-8 h-8 opacity-20" />
            </div>
          )}
          
          {/* Actions Hover */}
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur p-1 rounded-lg">
            <button
              onClick={handlePin}
              className={cn('p-1.5 rounded-md hover:bg-white/10 transition-colors', item.is_pinned ? 'text-gold' : 'text-white')}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-red-500/20 text-white hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // NOTE TYPE
  if (item.type === 'note' || item.type === 'code') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className={cn(
          'group relative flex flex-col p-4 rounded-xl transition-all cursor-pointer border border-transparent',
          isSelected ? 'bg-card border-border shadow-sm' : 'hover:bg-card/50 hover:border-border/50'
        )}
        onClick={handleSelect}
      >
        {item.is_pinned === 1 && <Pin className="absolute top-4 right-4 w-3.5 h-3.5 text-gold/70" />}
        
        {item.title && (
          <h3 className="font-semibold text-text-primary text-base mb-2 pr-6">
            {item.title}
          </h3>
        )}
        
        {item.content && item.type === 'note' && (
          <div className="text-sm text-text-secondary leading-relaxed line-clamp-4">
            <ReactMarkdown>{item.content}</ReactMarkdown>
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
            <button onClick={handlePin} className={cn('p-1.5 rounded-md hover:bg-border transition-colors', item.is_pinned ? 'text-gold' : 'text-text-muted hover:text-gold')}>
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // LINK TYPE — with thumbnail variant for YouTube/rich links
  const hasThumb = item.type === 'link' && !!item.image_path
  const isYouTube = item.url ? /youtube\.com|youtu\.be/.test(item.url) : false

  if (hasThumb) {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className={cn(
          'group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all border border-transparent',
          isSelected ? 'ring-2 ring-gold ring-offset-2 ring-offset-background border-transparent' : 'hover:border-border/50'
        )}
        onClick={handleSelect}
      >
        {/* Thumbnail */}
        <div className="w-full aspect-video bg-black/30 shrink-0 overflow-hidden relative">
          <img
            src={toFileUrl(item.image_path!)}
            alt={item.title || ''}
            className="w-full h-full object-cover"
          />
          {/* YouTube play badge */}
          {isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          )}
          {/* Actions */}
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur p-1 rounded-lg">
            {item.url && (
              <button onClick={handleOpenUrl} className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handlePin} className={cn('p-1.5 rounded-md hover:bg-white/10 transition-colors', item.is_pinned ? 'text-gold' : 'text-white')}>
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-red-500/20 text-white hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info below thumbnail */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-card/60">
          {showFavicon ? (
            <img src={item.favicon!} alt="" className="w-4 h-4 object-contain shrink-0" onError={() => setFaviconError(true)} />
          ) : (
            <span className={cn('shrink-0 flex items-center justify-center', TYPE_COLOR[item.type])}>
              <Link className="w-3.5 h-3.5" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-text-primary truncate leading-tight">
              {item.title || getDomain(item.url || '')}
            </p>
            <p className="text-xs text-text-muted truncate mt-0.5">
              {item.url ? getDomain(item.url) : ''}
              {item.content ? ` · ${truncate(item.content, 40)}` : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // LINK TYPE — standard layout (no thumbnail), rich preview design
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'group relative flex flex-col p-3.5 rounded-xl transition-all cursor-pointer border',
        isSelected
          ? 'bg-card border-border shadow-md'
          : 'bg-card/30 border-border/40 hover:bg-card/70 hover:border-border/80'
      )}
      onClick={handleSelect}
    >
      {/* Top row: favicon + domain + actions */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-6 h-6 rounded-md overflow-hidden bg-background border border-border/50 flex items-center justify-center">
            {showFavicon ? (
              <img
                src={item.favicon!}
                alt=""
                className="w-4 h-4 object-contain"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <span className={cn('flex items-center justify-center w-full h-full', TYPE_COLOR[item.type])}>
                <Link className="w-3 h-3" />
              </span>
            )}
          </div>
          {item.url && (
            <span className="text-xs text-text-muted truncate font-medium">
              {getDomain(item.url)}
            </span>
          )}
          {item.is_pinned === 1 && <Pin className="w-3 h-3 text-gold/70 shrink-0" />}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {item.url && (
            <button onClick={handleOpenUrl} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-sky-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handlePin} className={cn('p-1.5 rounded-md hover:bg-border transition-colors', item.is_pinned ? 'text-gold' : 'text-text-muted hover:text-gold')}>
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-border text-text-muted hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <p className="font-semibold text-sm text-text-primary leading-snug line-clamp-2 mb-1">
        {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
      </p>

      {/* Description */}
      {item.content && (
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mt-0.5">
          {item.content}
        </p>
      )}

      {/* Bottom: reading time */}
      {item.reading_time && item.reading_time > 1 && settings.showReadingTime && (
        <div className="flex items-center gap-1.5 mt-2.5 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          <span>{t.readingTimeMin(item.reading_time)}</span>
        </div>
      )}
    </div>
  )
}
