import { useState } from 'react'
import { X, Globe, Eye, Layers, FolderOpen, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { cn } from '../lib/utils'
import type { ItemType } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, selectedVault, selectVault } = useStore()
  const t = useT()
  const [dataPath, setDataPath] = useState<string | null>(null)
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [importCount, setImportCount] = useState(0)

  const loadDataPath = async () => {
    if (dataPath) return
    const p = await window.api.settings.getDataPath()
    setDataPath(p)
  }

  const handleImportBookmarks = async () => {
    const vaultId = selectedVault?.id ?? 1
    setImportState('loading')
    try {
      const result = await window.api.bookmarks.import(vaultId)
      if (result.cancelled) { setImportState('idle'); return }
      setImportCount(result.count)
      setImportState('done')
      if (selectedVault) selectVault(selectedVault)  // Refresh the grid
      setTimeout(() => setImportState('idle'), 4000)
    } catch (err) {
      console.error('Import failed:', err)
      setImportState('idle')
    }
  }

  if (!open) return null

  const types: { value: ItemType; label: string }[] = [
    { value: 'link',  label: t.link },
    { value: 'note',  label: t.note },
    { value: 'image', label: t.image },
    { value: 'code',  label: t.code }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">{t.settingsTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {/* Language */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
              <Globe className="w-3.5 h-3.5" />
              {t.settingsGeneral}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsLanguage}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['en', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => updateSettings({ language: lang })}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      settings.language === lang
                        ? 'bg-gold text-black'
                        : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {lang === 'en' ? t.settingsLanguageEn : t.settingsLanguageEs}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
              <Eye className="w-3.5 h-3.5" />
              {t.settingsAppearance}
            </div>

            <Toggle
              label={t.settingsShowReadingTime}
              value={settings.showReadingTime}
              onChange={(v) => updateSettings({ showReadingTime: v })}
            />

            <Toggle
              label={t.settingsCompactView}
              value={settings.compactView}
              onChange={(v) => updateSettings({ compactView: v })}
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsDefaultType}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {types.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateSettings({ defaultItemType: value })}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-medium transition-colors',
                      settings.defaultItemType === value
                        ? 'bg-gold text-black'
                        : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Import */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
              <Upload className="w-3.5 h-3.5" />
              Import
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-muted leading-relaxed">
                Import all bookmarks from Chrome, Firefox, Edge or Safari.
                Export them as <span className="font-mono bg-card px-1 rounded text-text-secondary">.html</span> from your browser first.
              </p>

              <button
                onClick={handleImportBookmarks}
                disabled={importState === 'loading'}
                className={cn(
                  'flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  importState === 'done'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-card border-border text-text-secondary hover:text-text-primary hover:border-border disabled:opacity-50'
                )}
              >
                {importState === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {importState === 'done'    && <CheckCircle2 className="w-3.5 h-3.5" />}
                {importState === 'idle'    && <Upload className="w-3.5 h-3.5" />}

                {importState === 'loading' && 'Importing…'}
                {importState === 'done'    && `Imported ${importCount} bookmarks ✓`}
                {importState === 'idle'    && 'Import browser bookmarks'}
              </button>

              <p className="text-[11px] text-text-muted/60">
                Metadata and thumbnails will be fetched in the background.
              </p>
            </div>
          </section>

          {/* Data */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
              <Layers className="w-3.5 h-3.5" />
              {t.settingsData}
            </div>

            <div
              className="flex flex-col gap-1.5"
              onMouseEnter={loadDataPath}
            >
              <span className="text-xs text-text-muted">{t.settingsDataLocation}</span>
              <p className="text-[11px] text-text-secondary font-mono truncate">
                {dataPath ?? '…'}
              </p>
              <button
                onClick={() => window.api.settings.openDataFolder()}
                className="flex items-center gap-1.5 self-start mt-1 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {t.settingsOpenFolder}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-primary">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors',
          value ? 'bg-gold' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            value ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}
