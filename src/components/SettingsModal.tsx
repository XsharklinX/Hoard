import { useState, useEffect } from 'react'
import {
  X, Globe, Eye, Layers, Upload, Loader2, CheckCircle2, Lock, Shield, ShieldOff,
  Download, HardDrive, AlertTriangle, FolderOpen, RefreshCw, Puzzle, Plus,
  ArrowDownToLine, RotateCcw, Info, Zap, Palette, Sparkles, FolderSync, FileText, Clock
} from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { cn } from '../lib/utils'
import { toast } from '../lib/toast'
import type { ItemType } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

type UpdaterState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloaded' | 'error'

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, selectedVault, selectVault, lockApp } = useStore()
  const t = useT()

  const [dataPath,       setDataPath]       = useState<string | null>(null)
  const [version,        setVersion]        = useState<string | null>(null)
  const [updaterState,   setUpdaterState]   = useState<UpdaterState>('idle')
  const [updateVersion,  setUpdateVersion]  = useState<string | null>(null)
  const [importState,    setImportState]    = useState<'idle' | 'loading' | 'done'>('idle')
  const [importDone,     setImportDone]     = useState(0)
  const [importTotal,    setImportTotal]    = useState(0)
  const [importCount,    setImportCount]    = useState(0)
  const [backupState,    setBackupState]    = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [exportHtmlState,  setExportHtmlState]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [exportSiteState,  setExportSiteState]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [syncState,      setSyncState]      = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // Encryption form state
  const [encPw,     setEncPw]     = useState('')
  const [encPwConf, setEncPwConf] = useState('')
  const [encOldPw,  setEncOldPw]  = useState('')
  const [encError,  setEncError]  = useState('')
  const [encOk,     setEncOk]     = useState('')
  const [disablePw, setDisablePw] = useState('')

  const lockOptions = [
    { value: 0,  label: 'Never' },
    { value: 5,  label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' }
  ]
  const backupIntervalOptions = [
    { value: 1,  label: 'Every day' },
    { value: 7,  label: 'Every week' },
    { value: 14, label: 'Every 2 weeks' },
    { value: 30, label: 'Every month' }
  ]

  // Load version and data path on open
  useEffect(() => {
    if (!open) return
    window.api.app.getVersion().then(setVersion)
    window.api.settings.getDataPath().then(setDataPath)
    setUpdaterState('idle')
    setUpdateVersion(null)
  }, [open])

  // Listen to updater push events while modal is open
  useEffect(() => {
    if (!open) return
    const h1 = window.api.on('updater:available',  (p: unknown) => {
      setUpdaterState('available')
      setUpdateVersion((p as { version: string }).version)
    })
    const h2 = window.api.on('updater:downloaded', (p: unknown) => {
      setUpdaterState('downloaded')
      setUpdateVersion((p as { version: string }).version)
    })
    const h3 = window.api.on('updater:up-to-date', () => setUpdaterState('up-to-date'))
    const h4 = window.api.on('updater:error',      () => setUpdaterState('error'))
    return () => {
      window.api.off('updater:available',  h1)
      window.api.off('updater:downloaded', h2)
      window.api.off('updater:up-to-date', h3)
      window.api.off('updater:error',      h4)
    }
  }, [open])

  // Bookmark import progress
  useEffect(() => {
    if (!open) return
    const handler = window.api.on('bookmarks:progress', (payload: unknown) => {
      const { done, total, finished } = payload as { done: number; total: number; finished?: boolean }
      setImportDone(done); setImportTotal(total)
      if (finished) {
        setImportState('done')
        if (selectedVault) selectVault(selectedVault)
        setTimeout(() => setImportState('idle'), 4000)
      }
    })
    return () => window.api.off('bookmarks:progress', handler)
  }, [open, selectedVault])

  const handleImportBookmarks = async () => {
    const vaultId = selectedVault?.id ?? 1
    setImportState('loading'); setImportDone(0); setImportTotal(0)
    try {
      const result = await window.api.bookmarks.import(vaultId)
      if (result.cancelled) { setImportState('idle'); return }
      setImportCount(result.count); setImportTotal(result.count)
    } catch { setImportState('idle') }
  }

  // Backup
  const handleExport = async () => {
    setBackupState('loading')
    try {
      const result = await window.api.backup.export()
      setBackupState(result.cancelled ? 'idle' : 'done')
      if (!result.cancelled) setTimeout(() => setBackupState('idle'), 3000)
    } catch { setBackupState('error') }
  }

  const handleImportBackup = async () => {
    setBackupState('loading')
    try {
      const result = await window.api.backup.import()
      if (result.cancelled) { setBackupState('idle'); return }
      setBackupState('done')
      setTimeout(() => { setBackupState('idle'); window.location.reload() }, 1500)
    } catch { setBackupState('error') }
  }

  const handleChooseBackupDir = async () => {
    const dir = await window.api.settings.chooseBackupDir()
    if (dir) updateSettings({ autoBackupPath: dir })
  }

  const handleExportHtml = async () => {
    setExportHtmlState('loading')
    try {
      const result = await window.api.backup.exportHtml()
      setExportHtmlState(result.cancelled ? 'idle' : 'done')
      if (!result.cancelled) setTimeout(() => setExportHtmlState('idle'), 3000)
    } catch { setExportHtmlState('error') }
  }

  const handleExportSite = async () => {
    const vault = useStore.getState().selectedVault
    if (!vault) return
    setExportSiteState('loading')
    try {
      const result = await window.api.export.site(vault.id)
      setExportSiteState(result.cancelled ? 'idle' : result.success ? 'done' : 'error')
      if (result.success) {
        toast.success(`Exported ${result.count} items to static site`)
        setTimeout(() => setExportSiteState('idle'), 3000)
      }
    } catch { setExportSiteState('error') }
  }

  const handleChooseSyncFolder = async () => {
    const dir = await window.api.settings.chooseBackupDir()
    if (dir) updateSettings({ syncFolderPath: dir })
  }

  const handleSyncNow = async () => {
    if (!settings.syncFolderPath) return
    setSyncState('loading')
    try {
      const result = await window.api.backup.exportJson(settings.syncFolderPath)
      setSyncState(result.error ? 'error' : 'done')
      setTimeout(() => setSyncState('idle'), 3000)
    } catch { setSyncState('error') }
  }

  // Updater
  const handleCheckUpdates = async () => {
    setUpdaterState('checking')
    const result = await window.api.app.checkUpdates()
    if (result.error === 'dev') {
      // Dev mode — fake "up to date" after a beat
      setTimeout(() => setUpdaterState('up-to-date'), 600)
    } else if (result.error) {
      setUpdaterState('error')
    }
    // Otherwise wait for push events
  }

  // Encryption
  const handleEnableEncryption = async () => {
    setEncError(''); setEncOk('')
    if (!encPw)              { setEncError('Enter a password'); return }
    if (encPw !== encPwConf) { setEncError('Passwords do not match'); return }
    if (encPw.length < 8)    { setEncError('Password must be at least 8 characters'); return }
    const res = await window.api.security.enableEncryption(encPw)
    if (res.success) {
      setEncOk('Encryption enabled. Your vault is now protected.')
      setEncPw(''); setEncPwConf('')
      await updateSettings({ encryptionEnabled: true })
    }
  }

  const handleDisableEncryption = async () => {
    setEncError(''); setEncOk('')
    if (!disablePw) { setEncError('Enter your current password to confirm'); return }
    const res = await window.api.security.disableEncryption(disablePw)
    if (res.success) {
      setEncOk('Encryption disabled.')
      setDisablePw('')
      await updateSettings({ encryptionEnabled: false })
    } else {
      setEncError(res.error ?? 'Wrong password')
    }
  }

  const handleChangePassword = async () => {
    setEncError(''); setEncOk('')
    if (!encOldPw || !encPw) { setEncError('Fill in both fields'); return }
    if (encPw !== encPwConf) { setEncError('New passwords do not match'); return }
    if (encPw.length < 8)    { setEncError('Password must be at least 8 characters'); return }
    const res = await window.api.security.changePassword(encOldPw, encPw)
    if (res.success) {
      setEncOk('Password changed successfully.')
      setEncOldPw(''); setEncPw(''); setEncPwConf('')
    } else {
      setEncError(res.error ?? 'Wrong current password')
    }
  }

  if (!open) return null

  const types: { value: ItemType; label: string }[] = [
    { value: 'link',  label: t.link },
    { value: 'note',  label: t.note },
    { value: 'image', label: t.image },
    { value: 'code',  label: t.code }
  ]
  const isEncrypted = settings.encryptionEnabled

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md max-h-[90vh] rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">{t.settingsTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">

          {/* ── Version & Updates ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Info className="w-3.5 h-3.5" />} label="About" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Hoard</p>
                <p className="text-[11px] text-text-muted">Version {version ?? '…'}</p>
              </div>
              <UpdaterButton state={updaterState} updateVersion={updateVersion} onCheck={handleCheckUpdates} onInstall={() => window.api.app.installUpdate()} />
            </div>
            {updaterState === 'up-to-date' && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />You're on the latest version
              </p>
            )}
            {updaterState === 'available' && updateVersion && (
              <p className="text-xs text-gold flex items-center gap-1.5">
                <ArrowDownToLine className="w-3 h-3 animate-bounce" />
                Downloading version {updateVersion}…
              </p>
            )}
            {updaterState === 'downloaded' && updateVersion && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Version {updateVersion} ready — restarts on quit
              </p>
            )}
            {updaterState === 'error' && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Update check failed
              </p>
            )}
          </section>

          {/* ── General ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Globe className="w-3.5 h-3.5" />} label={t.settingsGeneral} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsLanguage}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['en', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => updateSettings({ language: lang })}
                    className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                      settings.language === lang ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {lang === 'en' ? t.settingsLanguageEn : t.settingsLanguageEs}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Toggle label={t.settingsLaunchAtStartup} value={settings.launchAtStartup} onChange={(v) => updateSettings({ launchAtStartup: v })} />
              {settings.launchAtStartup && (
                <p className="text-[11px] text-text-muted pl-0">Only takes effect in the installed version</p>
              )}
            </div>
            <Toggle label="Minimize to tray on close" value={settings.minimizeToTray ?? true} onChange={(v) => updateSettings({ minimizeToTray: v })} />
          </section>

          {/* ── Appearance ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Eye className="w-3.5 h-3.5" />} label={t.settingsAppearance} />

            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <Palette className="w-3.5 h-3.5 text-text-muted" />
                Theme
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['dark', 'light', 'midnight'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors capitalize',
                      settings.theme === t ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Toggle label={t.settingsShowReadingTime} value={settings.showReadingTime}     onChange={(v) => updateSettings({ showReadingTime: v })} />
            <Toggle label="Show favicons on links"    value={settings.showFavicons ?? true} onChange={(v) => updateSettings({ showFavicons: v })} />
            <Toggle label={t.settingsCompactView}     value={settings.compactView}          onChange={(v) => updateSettings({ compactView: v })} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsDefaultType}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {types.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateSettings({ defaultItemType: value })}
                    className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors',
                      settings.defaultItemType === value ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── AI ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Sparkles className="w-3.5 h-3.5" />} label="AI Summaries" />
            <p className="text-xs text-text-muted leading-relaxed">
              Summarize links and notes using a local Ollama model, Claude, or Gemini. Press the ✦ button in the preview panel.
            </p>

            {/* Provider selector */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Provider</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['none', 'ollama', 'claude', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateSettings({ aiProvider: p })}
                    className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors capitalize',
                      settings.aiProvider === p ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {settings.aiProvider === 'ollama' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-muted">Ollama URL</label>
                  <input
                    type="text"
                    value={settings.aiOllamaUrl ?? 'http://localhost:11434'}
                    onChange={(e) => updateSettings({ aiOllamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-muted">Model name</label>
                  <input
                    type="text"
                    value={settings.aiOllamaModel ?? 'llama3'}
                    onChange={(e) => updateSettings({ aiOllamaModel: e.target.value })}
                    placeholder="llama3"
                    className={inputCls}
                  />
                </div>
              </>
            )}

            {settings.aiProvider === 'claude' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Claude API key</label>
                <input
                  type="password"
                  value={settings.aiClaudeApiKey ?? ''}
                  onChange={(e) => updateSettings({ aiClaudeApiKey: e.target.value })}
                  placeholder="sk-ant-…"
                  className={inputCls}
                />
                <p className="text-[11px] text-text-muted">Uses claude-haiku-4-5 (fast &amp; cheap)</p>
              </div>
            )}

            {settings.aiProvider === 'gemini' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Gemini API key</label>
                <input
                  type="password"
                  value={settings.aiGeminiApiKey ?? ''}
                  onChange={(e) => updateSettings({ aiGeminiApiKey: e.target.value })}
                  placeholder="AIza…"
                  className={inputCls}
                />
                <p className="text-[11px] text-text-muted">Uses gemini-1.5-flash · Get a free key at Google AI Studio</p>
              </div>
            )}
          </section>

          {/* ── Export ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<FileText className="w-3.5 h-3.5" />} label="Export" />
            <p className="text-xs text-text-muted leading-relaxed">
              Export your entire vault as a standalone HTML file or sync item data as JSON to a folder (for Dropbox, iCloud, etc.).
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleExportHtml} disabled={exportHtmlState === 'loading'}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  exportHtmlState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}>
                {exportHtmlState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exportHtmlState === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                {exportHtmlState === 'done' ? 'Exported ✓' : 'Export as HTML'}
              </button>
              <button onClick={handleExportSite} disabled={exportSiteState === 'loading'}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  exportSiteState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : exportSiteState === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}>
                {exportSiteState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exportSiteState === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                {exportSiteState === 'done' ? 'Site exported ✓' : 'Export as static site'}
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Toggle label="Sync to folder (JSON)" value={settings.syncFolderEnabled ?? false} onChange={(v) => updateSettings({ syncFolderEnabled: v })} />
              {settings.syncFolderEnabled && (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={handleChooseSyncFolder}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors shrink-0">
                      <FolderOpen className="w-3.5 h-3.5" />Choose folder
                    </button>
                    {settings.syncFolderPath
                      ? <span className="text-[11px] text-text-secondary font-mono truncate">{settings.syncFolderPath}</span>
                      : <span className="text-[11px] text-text-muted italic">No folder selected</span>}
                  </div>
                  <button onClick={handleSyncNow} disabled={!settings.syncFolderPath || syncState === 'loading'}
                    className={cn('flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      syncState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : syncState === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}>
                    {syncState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : syncState === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FolderSync className="w-3.5 h-3.5" />}
                    {syncState === 'done' ? 'Synced ✓' : syncState === 'error' ? 'Sync failed' : 'Sync now'}
                  </button>
                  <p className="text-[11px] text-text-muted">Writes one JSON file per vault to the selected folder. Use with Dropbox, OneDrive, or any synced folder.</p>
                </>
              )}
            </div>
          </section>

          {/* ── Browser Extension ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Puzzle className="w-3.5 h-3.5" />} label="Browser Extension" />
            <div className="flex items-start gap-3 p-3 rounded-xl bg-card/60 border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-gold" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-text-primary">Save to Hoard</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Right-click any link, image or page to save it instantly. Press <kbd className="px-1 py-0.5 rounded bg-border text-text-secondary text-[10px] font-mono">Alt+S</kbd> to open the quick-save popup.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold">Load in Chrome / Edge</p>
              <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open <span className="font-mono bg-card px-1 rounded text-text-secondary">chrome://extensions</span></li>
                <li>Enable <strong className="text-text-primary">Developer mode</strong> (top right)</li>
                <li>Click <strong className="text-text-primary">Load unpacked</strong> and select the extension folder</li>
              </ol>
              <button
                onClick={() => window.api.app.openExtensionFolder()}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors mt-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open extension folder
              </button>
            </div>

            <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
              <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold">Firefox</p>
              <p className="text-xs text-text-muted">Go to <span className="font-mono bg-card px-1 rounded text-text-secondary">about:debugging</span> → Load Temporary Add-on → select <span className="font-mono bg-card px-1 rounded">manifest.firefox.json</span></p>
            </div>
          </section>

          {/* ── Security ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} label="Security" />

            {isEncrypted ? (
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Vault encrypted with AES-256-GCM
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">Auto-lock after</span>
                  <select
                    value={settings.autoLockMinutes}
                    onChange={(e) => updateSettings({ autoLockMinutes: Number(e.target.value) })}
                    className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/50"
                  >
                    {lockOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button onClick={() => { onClose(); lockApp() }}
                  className="flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                  <Lock className="w-3.5 h-3.5" />Lock now
                </button>
                <div className="flex flex-col gap-2 pt-1 border-t border-border">
                  <p className="text-[11px] text-text-muted">Change master password</p>
                  <input type="password" placeholder="Current password" value={encOldPw} onChange={(e) => setEncOldPw(e.target.value)} className={inputCls} />
                  <input type="password" placeholder="New password (min. 8 chars)" value={encPw} onChange={(e) => setEncPw(e.target.value)} className={inputCls} />
                  <input type="password" placeholder="Confirm new password" value={encPwConf} onChange={(e) => setEncPwConf(e.target.value)} className={inputCls} />
                  <button onClick={handleChangePassword} className="self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                    Change password
                  </button>
                </div>
                <div className="flex flex-col gap-2 pt-1 border-t border-border">
                  <p className="text-[11px] text-text-muted">Disable encryption (stores data unencrypted)</p>
                  <div className="flex gap-2">
                    <input type="password" placeholder="Current password to confirm" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} className={cn(inputCls, 'flex-1')} />
                    <button onClick={handleDisableEncryption}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
                      <ShieldOff className="w-3.5 h-3.5" />Disable
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-text-muted leading-relaxed">
                  Protect your vault with AES-256-GCM encryption. You'll need the password every time Hoard starts.
                </p>
                <input type="password" placeholder="Master password (min. 8 chars)" value={encPw} onChange={(e) => setEncPw(e.target.value)} className={inputCls} />
                <input type="password" placeholder="Confirm password" value={encPwConf} onChange={(e) => setEncPwConf(e.target.value)} className={inputCls} />
                <button onClick={handleEnableEncryption}
                  className="flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-colors">
                  <Lock className="w-3.5 h-3.5" />Enable encryption
                </button>
              </div>
            )}

            {encError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{encError}</p>}
            {encOk    && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{encOk}</p>}
          </section>

          {/* ── Backup ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<HardDrive className="w-3.5 h-3.5" />} label="Backup" />
            <p className="text-xs text-text-muted leading-relaxed">
              Export your entire vault (database + images) as a <span className="font-mono bg-card px-1 rounded text-text-secondary">.hoard</span> file.
            </p>
            <div className="flex gap-2">
              <button onClick={handleExport} disabled={backupState === 'loading'}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  backupState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}>
                {backupState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : backupState === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                {backupState === 'done' ? 'Exported ✓' : 'Export'}
              </button>
              <button onClick={handleImportBackup} disabled={backupState === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" />Import
              </button>
            </div>
            {backupState === 'error' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Backup operation failed</p>}

            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Toggle label="Automatic backup" value={settings.autoBackupEnabled} onChange={(v) => updateSettings({ autoBackupEnabled: v })} />
              {settings.autoBackupEnabled && (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={handleChooseBackupDir}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors shrink-0">
                      <FolderOpen className="w-3.5 h-3.5" />Choose folder
                    </button>
                    {settings.autoBackupPath
                      ? <span className="text-[11px] text-text-secondary font-mono truncate">{settings.autoBackupPath}</span>
                      : <span className="text-[11px] text-text-muted italic">No folder selected</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Backup interval</span>
                    <select value={settings.autoBackupIntervalDays}
                      onChange={(e) => updateSettings({ autoBackupIntervalDays: Number(e.target.value) })}
                      className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/50">
                      {backupIntervalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {settings.autoBackupLastRun > 0 && (
                    <p className="text-[11px] text-text-muted flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />Last backup: {new Date(settings.autoBackupLastRun).toLocaleDateString()}
                    </p>
                  )}
                  {!settings.autoBackupPath && (
                    <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />Choose a folder to activate auto-backup
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── Import ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Upload className="w-3.5 h-3.5" />} label="Import" />
            <p className="text-xs text-text-muted leading-relaxed">
              Import bookmarks from Chrome, Firefox, Edge or Safari (HTML) or from Raindrop.io / Readwise (CSV).
            </p>
            <button onClick={handleImportBookmarks} disabled={importState === 'loading'}
              className={cn('flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                importState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}>
              {importState === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {importState === 'done'    && <CheckCircle2 className="w-3.5 h-3.5" />}
              {importState === 'idle'    && <Upload className="w-3.5 h-3.5" />}
              {importState === 'loading' ? `Enriching… (${importDone}/${importTotal})` : importState === 'done' ? `Imported ${importCount} bookmarks ✓` : 'Import browser bookmarks'}
            </button>
            {importState === 'loading' && importTotal > 0 && (
              <div className="w-full bg-border rounded-full h-1 overflow-hidden">
                <div className="bg-gold h-1 rounded-full transition-all" style={{ width: `${Math.round((importDone / importTotal) * 100)}%` }} />
              </div>
            )}
            <p className="text-[11px] text-text-muted/60">Metadata and thumbnails are fetched in the background.</p>
          </section>

          {/* ── Scheduled Tasks ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Clock className="w-3.5 h-3.5" />} label="Scheduled Tasks" />
            <Toggle
              label="Auto-archive old unread"
              description={`Mark unread links as read after ${settings.autoArchiveAfterDays ?? 30} days`}
              value={settings.autoArchiveEnabled ?? false}
              onChange={(v) => updateSettings({ autoArchiveEnabled: v })}
            />
            {settings.autoArchiveEnabled && (
              <div className="flex items-center justify-between pl-0">
                <span className="text-sm text-text-primary">Archive after</span>
                <select value={settings.autoArchiveAfterDays ?? 30}
                  onChange={(e) => updateSettings({ autoArchiveAfterDays: Number(e.target.value) })}
                  className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/50">
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            )}
            <Toggle
              label="Auto-purge dead links"
              description={`Permanently delete dead links after ${settings.autopurgeDeadLinksAfterDays ?? 90} days`}
              value={settings.autopurgeDeadLinksEnabled ?? false}
              onChange={(v) => updateSettings({ autopurgeDeadLinksEnabled: v })}
            />
            {settings.autopurgeDeadLinksEnabled && (
              <div className="flex items-center justify-between pl-0">
                <span className="text-sm text-text-primary">Purge after</span>
                <select value={settings.autopurgeDeadLinksAfterDays ?? 90}
                  onChange={(e) => updateSettings({ autopurgeDeadLinksAfterDays: Number(e.target.value) })}
                  className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/50">
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              </div>
            )}
          </section>

          {/* ── Templates ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<FileText className="w-3.5 h-3.5" />} label="Note Templates" />
            <p className="text-[11px] text-text-muted">Custom templates appear in the template picker when creating notes.</p>
            <div className="flex flex-col gap-2">
              {(settings.customTemplates ?? []).map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                  <span className="text-base">{tpl.icon}</span>
                  <span className="flex-1 text-sm text-text-secondary truncate">{tpl.label}</span>
                  <button
                    onClick={() => updateSettings({ customTemplates: (settings.customTemplates ?? []).filter(t => t.id !== tpl.id) })}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const name = window.prompt('Template name:')
                  if (!name?.trim()) return
                  const icon = window.prompt('Icon (emoji):', '📝') ?? '📝'
                  const body = window.prompt('Template content (Markdown):', '# ' + name) ?? ''
                  updateSettings({
                    customTemplates: [...(settings.customTemplates ?? []), {
                      id: Date.now().toString(), label: name.trim(), icon, markdown: body
                    }]
                  })
                  toast.success(`Template "${name.trim()}" created`)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-card border border-dashed border-border text-text-muted hover:text-gold hover:border-gold/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />New template
              </button>
            </div>
          </section>

          {/* ── Data ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label={t.settingsData} />
            <span className="text-xs text-text-muted">{t.settingsDataLocation}</span>
            <p className="text-[11px] text-text-secondary font-mono truncate">{dataPath ?? '…'}</p>
            <button onClick={() => window.api.settings.openDataFolder()}
              className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
              <FolderOpen className="w-3.5 h-3.5" />{t.settingsOpenFolder}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors'

function UpdaterButton({ state, updateVersion, onCheck, onInstall }: {
  state: UpdaterState
  updateVersion: string | null
  onCheck: () => void
  onInstall: () => void
}) {
  if (state === 'downloaded') {
    return (
      <button onClick={onInstall}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
        <RotateCcw className="w-3.5 h-3.5" />Restart & install
      </button>
    )
  }
  return (
    <button onClick={onCheck} disabled={state === 'checking' || state === 'available'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors">
      {state === 'checking' || state === 'available'
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <ArrowDownToLine className="w-3.5 h-3.5" />}
      {state === 'checking' ? 'Checking…' : 'Check for updates'}
    </button>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
      {icon}{label}
    </div>
  )
}

function Toggle({ label, value, onChange, description }: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  description?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 group">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary group-hover:text-gold transition-colors">{label}</span>
        {description && <span className="text-[11px] text-text-muted leading-tight">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-10 h-[22px] rounded-full transition-all duration-300 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 border border-transparent',
          value ? 'bg-gold shadow-[0_0_10px_rgba(201,149,42,0.2)]' : 'bg-border/60 hover:bg-border'
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full shadow-md transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
            value ? 'left-[22px]' : 'left-1'
          )}
        />
      </button>
    </div>
  )
}
