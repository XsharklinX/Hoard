import { X } from 'lucide-react'

interface ShortcutModalProps {
  open:    boolean
  onClose: () => void
}

const GROUPS = [
  {
    label: 'General',
    items: [
      { keys: ['Ctrl', 'N'],           desc: 'New item' },
      { keys: ['Ctrl', 'K'],           desc: 'Command palette (all vaults)' },
      { keys: ['Ctrl', ','],           desc: 'Open settings' },
      { keys: ['?'],                   desc: 'Show this cheatsheet' },
      { keys: ['G'],                   desc: 'Toggle graph view' },
    ]
  },
  {
    label: 'Navigation',
    items: [
      { keys: ['← → ↑ ↓'],            desc: 'Navigate grid items' },
      { keys: ['Enter'],               desc: 'Open focused item' },
      { keys: ['Esc'],                 desc: 'Deselect / close panel' },
    ]
  },
  {
    label: 'Selection',
    items: [
      { keys: ['Ctrl', 'Click'],       desc: 'Add item to selection' },
      { keys: ['Shift', 'Click'],      desc: 'Add item to selection' },
      { keys: ['Esc'],                 desc: 'Clear selection' },
    ]
  },
  {
    label: 'Quick capture',
    items: [
      { keys: ['Ctrl', 'Shift', 'Space'], desc: 'Toggle capture window' },
      { keys: ['Alt', 'S'],              desc: 'Browser extension popup' },
      { keys: ['Alt', 'Shift', 'S'],     desc: 'Quick-save from browser' },
    ]
  },
  {
    label: 'Search',
    items: [
      { keys: ['type:link'],           desc: 'Filter by item type (link / note / image / code)' },
      { keys: ['domain:github.com'],   desc: 'Filter by domain' },
      { keys: ['tag:myTag'],           desc: 'Filter by tag name' },
    ]
  },
  {
    label: 'Editor (notes)',
    items: [
      { keys: ['**text**'],            desc: 'Bold' },
      { keys: ['_text_'],              desc: 'Italic' },
      { keys: ['# / ## / ###'],        desc: 'Headings' },
      { keys: ['- / 1.'],             desc: 'List / numbered list' },
      { keys: ['- [ ]'],              desc: 'Task item' },
      { keys: ['```lang'],            desc: 'Code block' },
      { keys: ['@'],                   desc: 'Mention another item' },
    ]
  },
]

export function ShortcutModal({ open, onClose }: ShortcutModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl mx-4 glass-surface rounded-2xl shadow-2xl overflow-hidden animate-pop-in flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-text-primary">Keyboard shortcuts</span>
            <span className="text-[11px] text-text-muted">Press <kbd className="px-1 py-0.5 rounded bg-border text-text-secondary font-mono text-[9px]">?</kbd> to toggle</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 grid grid-cols-2 gap-x-6 gap-y-5">
          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold opacity-70">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1 border-b border-border/20 last:border-0">
                    <span className="text-xs text-text-muted">{item.desc}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {item.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-0.5">
                          <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-text-secondary font-mono text-[10px] whitespace-nowrap">
                            {k}
                          </kbd>
                          {ki < item.keys.length - 1 && (
                            <span className="text-text-muted text-[9px]">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
