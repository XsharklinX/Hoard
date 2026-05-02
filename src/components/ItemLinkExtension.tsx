import { ReactRenderer } from '@tiptap/react'
import Mention from '@tiptap/extension-mention'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Link, FileText, Image, Code } from 'lucide-react'
import { cn } from '../lib/utils'

// ── Suggestion list popup ─────────────────────────────────────────────────────

interface SItem { id: number; title: string | null; type: string }

const TYPE_ICON: Record<string, React.ElementType> = {
  link: Link, note: FileText, image: Image, code: Code
}

export const SuggestionList = forwardRef<
  { onKeyDown: (p: { event: KeyboardEvent }) => boolean },
  { items: SItem[]; command: (i: SItem) => void }
>(({ items, command }, ref) => {
  const [sel, setSel] = useState(0)
  useEffect(() => setSel(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === 'ArrowUp')   { setSel(s => (s - 1 + items.length) % items.length); return true }
      if (event.key === 'ArrowDown') { setSel(s => (s + 1) % items.length); return true }
      if (event.key === 'Enter')     { if (items[sel]) { command(items[sel]); return true } }
      return false
    }
  }))

  if (!items.length) return (
    <div className="px-3 py-2 text-xs text-text-muted italic">No items found</div>
  )

  return (
    <div className="flex flex-col py-1">
      {items.map((item, i) => {
        const Icon = TYPE_ICON[item.type] ?? FileText
        return (
          <button key={item.id} onClick={() => command(item)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs text-left w-full transition-colors',
              i === sel ? 'bg-gold/10 text-gold' : 'text-text-secondary hover:bg-card'
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{item.title || 'Untitled'}</span>
          </button>
        )
      })}
    </div>
  )
})
SuggestionList.displayName = 'SuggestionList'

// ── Extension factory ─────────────────────────────────────────────────────────

export function createItemLinkExtension(vaultId: number | undefined) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'item-link px-1 py-0.5 rounded bg-gold/10 text-gold text-xs font-medium cursor-pointer hover:bg-gold/20 transition-colors'
    },
    renderLabel: ({ node }) => `[[${node.attrs.label ?? node.attrs.id}]]`,
    suggestion: {
      char: '[[',
      allowSpaces: true,

      items: async ({ query }: { query: string }) => {
        if (!vaultId) return []
        try { return await window.api.items.searchItems(vaultId, query || '') }
        catch { return [] }
      },

      render: () => {
        let component: ReactRenderer<{ onKeyDown: (p: { event: KeyboardEvent }) => boolean }>
        let popup: HTMLDivElement | null = null

        return {
          onStart(props: Record<string, unknown>) {
            component = new ReactRenderer(SuggestionList, { props, editor: props.editor as never })

            popup = document.createElement('div')
            popup.className = 'fixed z-[600] min-w-[200px] max-w-[280px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden'
            document.body.appendChild(popup)
            popup.appendChild(component.element)

            const rect = (props.clientRect as () => DOMRect | null)?.()
            if (rect && popup) {
              popup.style.top  = `${rect.bottom + 4}px`
              popup.style.left = `${rect.left}px`
            }
          },

          onUpdate(props: Record<string, unknown>) {
            component.updateProps(props)
            const rect = (props.clientRect as () => DOMRect | null)?.()
            if (rect && popup) {
              popup.style.top  = `${rect.bottom + 4}px`
              popup.style.left = `${rect.left}px`
            }
          },

          onKeyDown(props: { event: KeyboardEvent }) {
            if (props.event.key === 'Escape') { popup?.remove(); return true }
            return component.ref?.onKeyDown(props) ?? false
          },

          onExit() {
            popup?.remove()
            popup = null
            component.destroy()
          }
        }
      }
    }
  })
}
