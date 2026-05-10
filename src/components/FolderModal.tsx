import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'

interface FolderModalProps {
  open: boolean
  onClose: () => void
}

type ConditionField = 'type' | 'read_status' | 'domain' | 'search' | 'has_image'
type ConditionOp    = 'is' | 'contains'

interface Condition {
  id: number
  field: ConditionField
  op: ConditionOp
  value: string
}

const FIELD_LABELS: Record<ConditionField, string> = {
  type:        'Type',
  read_status: 'Read status',
  domain:      'Domain',
  search:      'Contains text',
  has_image:   'Has image'
}

const FIELD_VALUES: Partial<Record<ConditionField, Array<{ value: string; label: string }>>> = {
  type:        [{ value: 'link', label: 'Link' }, { value: 'note', label: 'Note' }, { value: 'image', label: 'Image' }, { value: 'code', label: 'Code' }],
  read_status: [{ value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }],
  has_image:   [{ value: 'true', label: 'Yes' }]
}

const COMMON_ICONS = ['📁', '⭐', '🔖', '🗂️', '📌', '💡', '🔥', '💎', '🚀', '📚', '🎯', '🛠️', '🎨', '🌐', '📝', '🧪', '💻', '🎮', '🎵', '🏆']

let _cid = 0
const newCond = (): Condition => ({ id: ++_cid, field: 'type', op: 'is', value: 'link' })

function buildSmartQuery(conditions: Condition[], logic: 'AND' | 'OR'): string {
  const parts = conditions.map((c) => {
    if (c.field === 'type')        return { type: c.value }
    if (c.field === 'read_status') return { readStatus: c.value }
    if (c.field === 'domain')      return { domain: c.value }
    if (c.field === 'search')      return { search: c.value }
    if (c.field === 'has_image')   return { hasImage: true }
    return {}
  })
  return JSON.stringify({ logic, conditions: parts })
}

export function FolderModal({ open, onClose }: FolderModalProps) {
  const { createFolder, selectedFolder, folders, tags } = useStore()
  const t = useT()
  const [name,       setName]       = useState('')
  const [parentId,   setParentId]   = useState<number | undefined>(undefined)
  const [icon,       setIcon]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [isSmart,    setIsSmart]    = useState(false)
  const [logic,      setLogic]      = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<Condition[]>([newCond()])
  const [showIcons,  setShowIcons]  = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setParentId(selectedFolder?.id ?? undefined)
      setIcon('')
      setIsSmart(false)
      setLogic('AND')
      setConditions([newCond()])
      setShowIcons(false)
    }
  }, [open, selectedFolder])

  const addCondition = () => setConditions((c) => [...c, newCond()])
  const removeCondition = (id: number) => setConditions((c) => c.filter((x) => x.id !== id))
  const updateCondition = (id: number, patch: Partial<Condition>) =>
    setConditions((c) => c.map((x) => x.id === id ? { ...x, ...patch } : x))

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const smartQuery = isSmart ? buildSmartQuery(conditions, logic) : undefined
      await createFolder(name.trim(), isSmart ? undefined : parentId, smartQuery, icon || undefined)
      onClose()
    } finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">{t.newFolderTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Name + icon */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIcons((v) => !v)}
              className="shrink-0 w-9 h-9 rounded-lg border border-border bg-card hover:border-gold/40 transition-colors flex items-center justify-center text-lg"
              title="Choose icon"
            >
              {icon || '📁'}
            </button>
            <input
              type="text"
              placeholder={t.folderNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="input flex-1"
            />
          </div>

          {/* Icon picker */}
          {showIcons && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-card rounded-xl border border-border">
              <button
                onClick={() => { setIcon(''); setShowIcons(false) }}
                className="w-7 h-7 rounded-md hover:bg-border transition-colors text-xs text-text-muted"
              >—</button>
              {COMMON_ICONS.map((em) => (
                <button
                  key={em}
                  onClick={() => { setIcon(em); setShowIcons(false) }}
                  className={`w-7 h-7 rounded-md hover:bg-border transition-colors text-base ${icon === em ? 'bg-gold/20 ring-1 ring-gold' : ''}`}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Parent folder (only for non-smart) */}
          {folders.length > 0 && !isSmart && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{t.parentFolderLabel}</label>
              <select
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                className="input"
              >
                <option value="">{t.noParent}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.icon ? f.icon + ' ' : ''}{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Smart folder toggle */}
          <label className="flex items-center gap-2 text-sm text-text-primary mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isSmart}
              onChange={(e) => setIsSmart(e.target.checked)}
              className="rounded border-border bg-surface text-gold focus:ring-gold/20"
            />
            Make this a Smart Folder
          </label>

          {/* Query builder */}
          {isSmart && (
            <div className="flex flex-col gap-2 p-3 bg-card rounded-xl border border-border">
              {/* Logic toggle */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-text-muted">Match</span>
                {(['AND', 'OR'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLogic(l)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${logic === l ? 'bg-gold/20 text-gold' : 'bg-border/50 text-text-muted hover:text-text-primary'}`}
                  >
                    {l}
                  </button>
                ))}
                <span className="text-xs text-text-muted">conditions</span>
              </div>

              {/* Conditions list */}
              {conditions.map((cond) => (
                <div key={cond.id} className="flex items-center gap-1.5">
                  {/* Field */}
                  <select
                    value={cond.field}
                    onChange={(e) => {
                      const field = e.target.value as ConditionField
                      const defaultVal = FIELD_VALUES[field]?.[0]?.value ?? ''
                      updateCondition(cond.id, { field, value: defaultVal })
                    }}
                    className="input text-xs flex-1 py-1"
                  >
                    {(Object.entries(FIELD_LABELS) as [ConditionField, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>

                  {/* Value */}
                  {FIELD_VALUES[cond.field] ? (
                    <select
                      value={cond.value}
                      onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                      className="input text-xs flex-1 py-1"
                    >
                      {FIELD_VALUES[cond.field]!.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                      placeholder={cond.field === 'domain' ? 'e.g. github.com' : 'search term'}
                      className="input text-xs flex-1 py-1"
                    />
                  )}

                  <button
                    onClick={() => removeCondition(cond.id)}
                    disabled={conditions.length === 1}
                    className="p-1 rounded text-text-muted hover:text-red-400 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                onClick={addCondition}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors mt-0.5"
              >
                <Plus className="w-3 h-3" /> Add condition
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-card transition-colors">
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold-light disabled:opacity-50 transition-colors"
          >
            {t.create}
          </button>
        </div>
      </div>
    </div>
  )
}
