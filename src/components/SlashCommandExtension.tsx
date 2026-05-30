import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { cn } from '../lib/utils'
import { CALLOUT_TYPES } from './CalloutExtension'

// ── Command definitions ───────────────────────────────────────────────────────

interface SlashCommand {
  id:      string
  label:   string
  icon:    string
  desc:    string
  command: (editor: Editor) => void
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'h1', label: 'Heading 1', icon: 'H1', desc: 'Large section heading',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleHeading({ level: 1 }).run()
  },
  {
    id: 'h2', label: 'Heading 2', icon: 'H2', desc: 'Medium section heading',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleHeading({ level: 2 }).run()
  },
  {
    id: 'h3', label: 'Heading 3', icon: 'H3', desc: 'Small section heading',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleHeading({ level: 3 }).run()
  },
  {
    id: 'bullet', label: 'Bullet list', icon: '•', desc: 'Unordered list',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleBulletList().run()
  },
  {
    id: 'numbered', label: 'Numbered list', icon: '1.', desc: 'Ordered list',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleOrderedList().run()
  },
  {
    id: 'todo', label: 'Task list', icon: '☐', desc: 'Checklist',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleTaskList().run()
  },
  {
    id: 'table', label: 'Table', icon: '⊞', desc: '3×3 table',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
  {
    id: 'blockquote', label: 'Quote', icon: '❝', desc: 'Blockquote',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).toggleBlockquote().run()
  },
  {
    id: 'divider', label: 'Divider', icon: '—', desc: 'Horizontal rule',
    command: (e) => e.chain().focus().deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to }).setHorizontalRule().run()
  },
  // Callouts
  ...Object.entries(CALLOUT_TYPES).map(([k, v]) => ({
    id:      `callout-${k}`,
    label:   `Callout ${v.label}`,
    icon:    v.icon,
    desc:    `${v.label} callout block`,
    command: (e: Editor) => {
      e.chain().focus()
        .deleteRange({ from: e.state.selection.$from.start(), to: e.state.selection.to })
        .insertContent({ type: 'callout', attrs: { calloutType: k }, content: [{ type: 'paragraph' }] })
        .run()
    }
  }))
]

// ── Suggestion list UI ────────────────────────────────────────────────────────

interface SlashListHandle { onKeyDown: (p: SuggestionKeyDownProps) => boolean }

const SlashList = forwardRef<SlashListHandle, SuggestionProps<SlashCommand>>(
  ({ items, command }, ref) => {
    const [sel, setSel] = useState(0)
    useEffect(() => setSel(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (event.key === 'ArrowUp')   { setSel(i => (i - 1 + items.length) % Math.max(1, items.length)); return true }
        if (event.key === 'ArrowDown') { setSel(i => (i + 1) % Math.max(1, items.length));                return true }
        if (event.key === 'Enter')     { if (items[sel]) { command(items[sel]); return true } }
        return false
      }
    }))

    if (!items.length) return (
      <div className="px-3 py-2 text-xs text-text-muted italic">No commands found</div>
    )

    return (
      <div className="flex flex-col">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-left transition-colors text-xs',
              i === sel ? 'bg-gold/15 text-gold' : 'text-text-secondary hover:bg-card hover:text-text-primary'
            )}
          >
            <span className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center text-[11px] font-bold shrink-0 text-text-muted">
              {item.icon}
            </span>
            <div>
              <div className="font-medium">{item.label}</div>
              <div className="text-[10px] text-text-muted">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    )
  }
)

// ── TipTap extension ──────────────────────────────────────────────────────────

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: true,
        allowSpaces: false,

        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase()
          return COMMANDS.filter(c =>
            !q || c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
          ).slice(0, 10)
        },

        command: ({ editor, range, props }: { editor: Editor; range: any; props: SlashCommand }) => {
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        },

        render: () => {
          let renderer: ReactRenderer<SlashListHandle>
          let container: HTMLDivElement

          const position = (rect: DOMRect | null | undefined) => {
            if (!rect || !container) return
            const spaceBelow = window.innerHeight - rect.bottom
            if (spaceBelow > 280) {
              container.style.top  = `${rect.bottom + 6}px`
              container.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`
            } else {
              container.style.bottom = `${window.innerHeight - rect.top + 6}px`
              container.style.top    = 'auto'
              container.style.left   = `${Math.min(rect.left, window.innerWidth - 280)}px`
            }
          }

          return {
            onStart(props: SuggestionProps<SlashCommand>) {
              container = document.createElement('div')
              Object.assign(container.style, {
                position: 'fixed', zIndex: '9999',
                background: 'var(--hoard-surface, #141414)',
                border: '1px solid var(--hoard-border, #2a2a2a)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                minWidth: '240px', maxWidth: '300px',
                overflow: 'hidden', padding: '4px 0',
                maxHeight: '320px', overflowY: 'auto'
              })
              document.body.appendChild(container)
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor as any })
              container.appendChild(renderer.element)
              position(props.clientRect?.())
            },
            onUpdate(props: SuggestionProps<SlashCommand>) {
              renderer.updateProps(props)
              position(props.clientRect?.())
            },
            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === 'Escape') { container?.remove(); return true }
              return renderer.ref?.onKeyDown(props) ?? false
            },
            onExit() { renderer.destroy(); container?.remove() }
          }
        }
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({ editor: this.editor, ...this.options.suggestion })
    ]
  }
})
