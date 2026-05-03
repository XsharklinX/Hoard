import { useState } from 'react'
import { Link, FileText, Image, Code, Pin, Circle, Clock } from 'lucide-react'
import { cn, formatDate, getDomain } from '../lib/utils'
import { useStore } from '../store'
import type { Item } from '../types'

const TYPE_ICON: Record<Item['type'], React.ElementType> = {
  link: Link, note: FileText, image: Image, code: Code
}
const TYPE_COLOR: Record<Item['type'], string> = {
  link:  'text-blue-400',
  note:  'text-emerald-400',
  image: 'text-purple-400',
  code:  'text-amber-400'
}

interface ItemRowProps {
  item:   Item
  onEdit: () => void
  onMove: () => void
}

export function ItemRow({ item, onEdit, onMove }: ItemRowProps) {
  const { selectItem, selectedItem, settings, toggleSelect, selectedIds } = useStore()
  const Icon      = TYPE_ICON[item.type]
  const isSelected = selectedItem?.id === item.id
  const isChecked  = selectedIds.has(item.id)
  const [faviconErr, setFaviconErr] = useState(false)
  const showFavicon = settings.showFavicons && item.type === 'link' && item.favicon && !faviconErr

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleSelect(item.id)
      return
    }
    selectItem(item)
  }

  const handleDoubleClick = () => onEdit()

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2 border-b border-border/40 cursor-pointer transition-colors group text-sm',
        isSelected ? 'bg-gold/5 border-l-2 border-l-gold' : 'hover:bg-card/50',
        isChecked  && 'bg-gold/8'
      )}
    >
      {/* Type / favicon icon */}
      <div className={cn('shrink-0 w-5 h-5 flex items-center justify-center', TYPE_COLOR[item.type])}>
        {showFavicon ? (
          <img
            src={item.favicon!}
            alt=""
            className="w-4 h-4 rounded-sm object-contain"
            onError={() => setFaviconErr(true)}
          />
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <p className={cn('truncate leading-tight', isSelected ? 'text-text-primary font-medium' : 'text-text-primary')}>
          {item.title || (item.url ? getDomain(item.url) : 'Untitled')}
        </p>
        {item.type === 'link' && item.url && (
          <p className="text-[11px] text-text-muted truncate">{getDomain(item.url)}</p>
        )}
        {item.type === 'note' && item.content && (
          <p className="text-[11px] text-text-muted truncate">
            {item.content.replace(/<[^>]+>/g, ' ').slice(0, 80)}
          </p>
        )}
        {item.type === 'code' && item.code_lang && (
          <p className="text-[11px] text-text-muted font-mono">{item.code_lang}</p>
        )}
      </div>

      {/* Reading time */}
      {item.type === 'link' && item.reading_time && settings.showReadingTime && (
        <div className="hidden md:flex items-center gap-1 text-[11px] text-text-muted shrink-0">
          <Clock className="w-3 h-3" />
          {item.reading_time}m
        </div>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {item.tags.slice(0, 4).map(tag => (
            <span
              key={tag.id}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: tag.color }}
              title={tag.name}
            />
          ))}
        </div>
      )}

      {/* Unread dot */}
      {item.read_status === 'unread' && (
        <Circle className="w-2 h-2 text-sky-400 fill-sky-400/60 shrink-0" />
      )}

      {/* Pin */}
      {item.is_pinned === 1 && (
        <Pin className="w-3 h-3 text-gold fill-current shrink-0" />
      )}

      {/* Date */}
      <span className="hidden lg:block text-[11px] text-text-muted shrink-0 w-20 text-right">
        {formatDate(item.created_at)}
      </span>
    </div>
  )
}
