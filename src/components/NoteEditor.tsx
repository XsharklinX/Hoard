import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CharacterCount } from '@tiptap/extension-character-count'
import TipImage from '@tiptap/extension-image'
import { Mathematics } from '@tiptap/extension-mathematics'
import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered,
  ListTodo, Link as LinkIcon, Minus, Undo, Redo, Heading2,
  Table as TableIcon, Maximize2, Minimize2, Image as ImageIcon,
  ListTree, Sigma
} from 'lucide-react'
import { cn, toFileUrl } from '../lib/utils'
import { createItemLinkExtension } from './ItemLinkExtension'
import { Callout } from './CalloutExtension'
import { SlashCommand } from './SlashCommandExtension'
import { useStore } from '../store'
import 'katex/dist/katex.min.css'

interface NoteEditorProps {
  content: string
  readOnly?: boolean
  onChange?: (html: string) => void
  onBlur?: (html: string) => void
  placeholder?: string
  onMentionClick?: (id: number) => void
}

export function NoteEditor({ content, readOnly = false, onChange, onBlur, placeholder, onMentionClick }: NoteEditorProps) {
  const { selectedVault } = useStore()
  const vaultId    = selectedVault?.id
  const itemLinkExt = useMemo(() => createItemLinkExtension(vaultId), [vaultId])
  const [focusMode, setFocusMode] = useState(false)
  const [tocOpen,   setTocOpen]   = useState(false)
  const [imgInput,  setImgInput]  = useState<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write your note… (type / for commands, [[ to link items)' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-400 underline cursor-pointer' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      CharacterCount,
      TipImage.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg my-2' } }),
      Mathematics,
      Callout,
      SlashCommand,
      itemLinkExt
    ],
    content: normalizeContent(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => { onChange?.(editor.getHTML()) },
    onBlur:   ({ editor }) => { onBlur?.(editor.getHTML()) },
    editorProps: {
      attributes: { class: 'outline-none min-h-[80px] prose prose-invert prose-sm max-w-none' },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false
        const file = event.dataTransfer?.files[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = async () => {
          const dataUrl = reader.result as string
          const storedPath = await window.api.util.saveImageData(dataUrl)
          const src = toFileUrl(storedPath)
          view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))
        }
        return true
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) continue
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = async () => {
              const dataUrl = reader.result as string
              const storedPath = await window.api.util.saveImageData(dataUrl)
              const src = toFileUrl(storedPath)
              view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))
            }
            return true
          }
        }
        return false
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    const incoming = normalizeContent(content)
    if (editor.getHTML() !== incoming) editor.commands.setContent(incoming, false)
  }, [content, editor])

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [readOnly, editor])

  useEffect(() => {
    if (!focusMode) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusMode(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url  = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const pickImage = useCallback(async () => {
    const path = await window.api.util.openImageDialog()
    if (!path || !editor) return
    const stored = await window.api.util.saveImage(path)
    editor.chain().focus().setImage({ src: toFileUrl(stored) }).run()
  }, [editor])

  // Extract headings for TOC
  const headings = useMemo(() => {
    if (!editor) return []
    const json    = editor.getJSON()
    const result: Array<{ level: number; text: string; idx: number }> = []
    function walk(nodes: any[]) {
      for (const n of nodes) {
        if (n.type === 'heading') {
          const text = (n.content ?? []).map((c: any) => c.text ?? '').join('')
          result.push({ level: n.attrs?.level ?? 1, text, idx: result.length })
        }
        if (n.content) walk(n.content)
      }
    }
    if (json.content) walk(json.content)
    return result
  }, [editor?.getHTML()])  // re-compute when content changes

  if (!editor) return null

  const wordCount = editor.storage.characterCount?.words() ?? 0

  if (readOnly) {
    const handleMentionClick = onMentionClick
      ? (e: React.MouseEvent<HTMLDivElement>) => {
          const target = (e.target as Element).closest('[data-type="mention"]')
          if (!target) return
          const id = parseInt(target.getAttribute('data-id') ?? '', 10)
          if (id) onMentionClick(id)
        }
      : undefined

    return (
      <div onClick={handleMentionClick}>
        <EditorContent
          editor={editor}
          className="prose prose-invert prose-xs max-w-none text-text-secondary text-xs leading-relaxed"
        />
      </div>
    )
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-0.5 px-2 pt-2 pb-1 border-b border-border/50">
      <ToolBtn active={editor.isActive('bold')}           onClick={() => editor.chain().focus().toggleBold().run()}          title="Bold"><Bold          className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('italic')}         onClick={() => editor.chain().focus().toggleItalic().run()}        title="Italic"><Italic        className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('strike')}         onClick={() => editor.chain().focus().toggleStrike().run()}        title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('code')}           onClick={() => editor.chain().focus().toggleCode().run()}          title="Inline code"><Code         className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading"><Heading2     className="w-3.5 h-3.5" /></ToolBtn>
      <Divider />
      <ToolBtn active={editor.isActive('bulletList')}     onClick={() => editor.chain().focus().toggleBulletList().run()}    title="Bullet list"><List         className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('orderedList')}    onClick={() => editor.chain().focus().toggleOrderedList().run()}   title="Numbered list"><ListOrdered  className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('taskList')}       onClick={() => editor.chain().focus().toggleTaskList().run()}      title="Task list"><ListTodo    className="w-3.5 h-3.5" /></ToolBtn>
      <Divider />
      <ToolBtn active={editor.isActive('link')}           onClick={setLink}                                                  title="Link"><LinkIcon     className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('table')}          onClick={insertTable}                                              title="Insert table"><TableIcon    className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={false}                             onClick={() => editor.chain().focus().setHorizontalRule().run()}   title="Divider"><Minus        className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={false}                             onClick={pickImage}                                                title="Insert image"><ImageIcon    className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={editor.isActive('math')}           onClick={() => editor.chain().focus().insertContent('$').run()}   title="Math (KaTeX)"><Sigma        className="w-3.5 h-3.5" /></ToolBtn>
      <Divider />
      <ToolBtn active={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}            title="Undo"><Undo          className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn active={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}            title="Redo"><Redo          className="w-3.5 h-3.5" /></ToolBtn>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-[10px] text-text-muted tabular-nums">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        {headings.length >= 3 && (
          <ToolBtn active={tocOpen} onClick={() => setTocOpen(v => !v)} title="Table of contents">
            <ListTree className="w-3.5 h-3.5" />
          </ToolBtn>
        )}
        <ToolBtn active={focusMode} onClick={() => setFocusMode((v) => !v)} title={focusMode ? 'Exit focus (Esc)' : 'Focus mode'}>
          {focusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </ToolBtn>
      </div>
    </div>
  )

  const editorBody = (
    <div className={cn('flex gap-0', tocOpen && 'divide-x divide-border/50')}>
      {/* TOC */}
      {tocOpen && (
        <div className="w-44 shrink-0 py-2 px-3 overflow-y-auto max-h-64 text-[11px]">
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-2">Contents</p>
          {headings.map((h) => (
            <div
              key={h.idx}
              className="py-0.5 text-text-muted hover:text-text-primary cursor-pointer transition-colors truncate"
              style={{ paddingLeft: (h.level - 1) * 10 }}
              onClick={() => {
                // Find the heading node in the DOM and scroll to it
                const headings = document.querySelectorAll('.ProseMirror h1,h2,h3,h4,h5,h6')
                const target = Array.from(headings).find(el => el.textContent?.trim() === h.text)
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {h.text || '(empty)'}
            </div>
          ))}
        </div>
      )}
      {/* Editor */}
      <div className={cn('flex-1 px-3 py-2', focusMode && 'overflow-y-auto')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )

  if (focusMode) {
    return (
      <div className="fixed inset-0 z-[900] flex flex-col bg-[#0f0f0f]">
        <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto min-h-0">
          {toolbar}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <EditorContent editor={editor} className="prose prose-invert prose-base max-w-none min-h-full" />
          </div>
          <div className="px-6 py-2 border-t border-border/30 flex items-center justify-between">
            <span className="text-xs text-text-muted">{wordCount} words</span>
            <span className="text-xs text-text-muted">Esc to exit focus</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border focus-within:border-gold/40 focus-within:ring-1 focus-within:ring-gold/20 transition-colors bg-black/10 overflow-hidden">
      {toolbar}
      {editorBody}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeContent(raw: string): string {
  if (!raw) return ''
  return raw.trimStart().startsWith('<') ? raw : `<p>${raw.replace(/\n/g, '</p><p>')}</p>`
}

function ToolBtn({ children, active, disabled, onClick, title }: {
  children: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void; title: string
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={cn('p-1.5 rounded-md transition-colors',
        active   ? 'bg-gold/20 text-gold' : 'text-text-muted hover:bg-card hover:text-text-primary',
        disabled && 'opacity-30 cursor-not-allowed'
      )}>
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-4 bg-border mx-0.5 shrink-0" />
}
