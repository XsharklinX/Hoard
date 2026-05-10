import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react'
import { useStore } from '../store'
import { toFileUrl } from '../lib/utils'
import { cn } from '../lib/utils'
import { toast } from '../lib/toast'

export function ImageLightbox() {
  const { lightboxItem, closeLightbox, items, openLightbox } = useStore()
  const [scale,    setScale]    = useState(1)
  const [offset,   setOffset]   = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const imageItems = items.filter((i) => i.type === 'image' && (i.image_path || i.url?.startsWith('http')))
  const currentIdx = lightboxItem ? imageItems.findIndex((i) => i.id === lightboxItem.id) : -1

  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [])

  const goTo = useCallback((idx: number) => {
    const next = imageItems[idx]
    if (next) { openLightbox(next); reset() }
  }, [imageItems, openLightbox, reset])

  const goPrev = useCallback(() => { if (currentIdx > 0) goTo(currentIdx - 1) }, [currentIdx, goTo])
  const goNext = useCallback(() => { if (currentIdx < imageItems.length - 1) goTo(currentIdx + 1) }, [currentIdx, imageItems.length, goTo])

  // Keyboard
  useEffect(() => {
    if (!lightboxItem) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      { closeLightbox(); reset() }
      if (e.key === 'ArrowLeft')   goPrev()
      if (e.key === 'ArrowRight')  goNext()
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 4))
      if (e.key === '-')           setScale((s) => Math.max(s - 0.25, 0.25))
      if (e.key === '0')           reset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxItem, goPrev, goNext, closeLightbox, reset])

  // Scroll-to-zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setScale((s) => Math.max(0.25, Math.min(4, s + delta)))
  }

  // Pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my)
    })
  }
  const handleMouseUp = () => { setDragging(false); dragStart.current = null }

  const handleDownload = async () => {
    if (!lightboxItem?.image_path) return
    const r = await window.api.util.exportImage(lightboxItem.image_path)
    if (r.success) toast.success('Image downloaded')
  }

  if (!lightboxItem) return null

  const src = lightboxItem.image_path ? toFileUrl(lightboxItem.image_path) : lightboxItem.url!

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/92 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) { closeLightbox(); reset() } }}
      onWheel={handleWheel}
    >
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10 select-none">
        <p className="text-sm text-white/70 truncate max-w-xs">
          {lightboxItem.title || `Image ${currentIdx + 1}`}
          {imageItems.length > 1 && (
            <span className="ml-2 text-white/40 text-xs">{currentIdx + 1} / {imageItems.length}</span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <ToolBtn onClick={() => setScale((s) => Math.min(s + 0.25, 4))} title="Zoom in (+)"><ZoomIn className="w-4 h-4" /></ToolBtn>
          <span className="text-xs text-white/50 w-10 text-center">{Math.round(scale * 100)}%</span>
          <ToolBtn onClick={() => setScale((s) => Math.max(s - 0.25, 0.25))} title="Zoom out (-)"><ZoomOut className="w-4 h-4" /></ToolBtn>
          <ToolBtn onClick={reset} title="Reset zoom (0)"><RotateCcw className="w-4 h-4" /></ToolBtn>
          {lightboxItem.image_path && (
            <ToolBtn onClick={handleDownload} title="Download"><Download className="w-4 h-4" /></ToolBtn>
          )}
          <ToolBtn onClick={() => { closeLightbox(); reset() }} title="Close (Esc)"><X className="w-4 h-4" /></ToolBtn>
        </div>
      </div>

      {/* Prev arrow */}
      {currentIdx > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next arrow */}
      {currentIdx < imageItems.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div
        className={cn('select-none', scale > 1 ? 'cursor-grab' : 'cursor-default', dragging && 'cursor-grabbing')}
        style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`, transition: dragging ? 'none' : 'transform 0.1s ease' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt={lightboxItem.title ?? ''}
          className="max-w-[90vw] max-h-[88vh] object-contain rounded-lg shadow-2xl block"
          draggable={false}
        />
      </div>

      {/* Thumbnail strip — only when multiple images */}
      {imageItems.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1.5 pb-3 px-4 overflow-x-auto bg-gradient-to-t from-black/50 to-transparent z-10">
          {imageItems.map((img, idx) => {
            const thumbSrc = img.image_path ? toFileUrl(img.image_path) : img.url!
            return (
              <button
                key={img.id}
                onClick={() => goTo(idx)}
                className={cn(
                  'w-12 h-12 rounded-md overflow-hidden shrink-0 border-2 transition-all',
                  idx === currentIdx ? 'border-gold opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                )}
              >
                <img src={thumbSrc} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
    >
      {children}
    </button>
  )
}
