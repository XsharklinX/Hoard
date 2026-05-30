import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'

// ── Callout types ─────────────────────────────────────────────────────────────

export const CALLOUT_TYPES = {
  note:    { icon: '💡', label: 'Note',    border: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
  warning: { icon: '⚠️', label: 'Warning', border: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  tip:     { icon: '✅', label: 'Tip',     border: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
  danger:  { icon: '❌', label: 'Danger',  border: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  info:    { icon: 'ℹ️', label: 'Info',    border: '#818cf8', bg: 'rgba(129,140,248,0.08)' },
  quote:   { icon: '❝',  label: 'Quote',   border: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
} as const

export type CalloutType = keyof typeof CALLOUT_TYPES

// ── React view component ──────────────────────────────────────────────────────

function CalloutView({ node, updateAttributes, editor }: any) {
  const type = (node.attrs.calloutType as CalloutType) ?? 'note'
  const config = CALLOUT_TYPES[type] ?? CALLOUT_TYPES.note

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        style={{
          borderLeft: `3px solid ${config.border}`,
          background: config.bg,
          borderRadius: '0 8px 8px 0',
          padding: '10px 14px',
          margin: '8px 0',
        }}
      >
        {/* Type selector header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, userSelect: 'none' }}>
          <span style={{ fontSize: 14 }}>{config.icon}</span>
          <select
            value={type}
            onChange={(e) => updateAttributes({ calloutType: e.target.value })}
            style={{
              background: 'transparent',
              border: 'none',
              color: config.border,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}
          >
            {Object.entries(CALLOUT_TYPES).map(([k, v]) => (
              <option key={k} value={k} style={{ background: '#141414', color: '#e0e0e0' }}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </div>
        {/* Editable content */}
        <NodeViewContent
          as="div"
          style={{ color: '#d0d0d8', fontSize: 13, lineHeight: 1.65 }}
        />
      </div>
    </NodeViewWrapper>
  )
}

// ── TipTap extension ──────────────────────────────────────────────────────────

export const Callout = Node.create({
  name:    'callout',
  group:   'block',
  content: 'block+',

  addAttributes() {
    return {
      calloutType: { default: 'note' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-callout-type': HTMLAttributes.calloutType }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  }
})
