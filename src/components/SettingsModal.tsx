import { useState, useEffect } from 'react'
import { X, Globe, Eye, Layers, Upload, Loader2, CheckCircle2, Lock, Shield, ShieldOff, Download, HardDrive, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { cn } from '../lib/utils'
import type { ItemType } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, selectedVault, selectVault, lockApp } = useStore()
  const t = useT()

  const [dataPath,     setDataPath]     = useState<string | null>(null)
  const [importState,  setImportState]  = useState<'idle' | 'loading' | 'done'>('idle')
  const [importCount,  setImportCount]  = useState(0)
  const [importDone,   setImportDone]   = useState(0)
  const [importTotal,  setImportTotal]  = useState(0)
  const [backupState,  setBackupState]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // Encryption form state
  const [encPw,     setEncPw]     = useState('')
  const [encPwConf, setEncPwConf] = useState('')
  const [encOldPw,  setEncOldPw]  = useState('')
  const [encError,  setEncError]  = useState('')
  const [encOk,     setEncOk]     = useState('')
  const [disablePw, setDisablePw] = useState('')

  // Auto-lock options
  const lockOptions = [
    { value: 0,  label: 'Never' },
    { value: 5,  label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' }
  ]

  const loadDataPath = async () => { if (dataPath) return; setDataPath(await window.api.settings.getDataPath()) }

  // ── Bookmark import with progress ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = window.api.on('bookmarks:progress', (payload: unknown) => {
      const { done, total, finished } = payload as { done: number; total: number; finished?: boolean }
      setImportDone(done)
      setImportTotal(total)
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
    setImportState('loading')
    setImportDone(0)
    setImportTotal(0)
    try {
      const result = await window.api.bookmarks.import(vaultId)
      if (result.cancelled) { setImportState('idle'); return }
      setImportCount(result.count)
      setImportTotal(result.count)
    } catch {
      setImportState('idle')
    }
  }

  // ── Backup ────────────────────────────────────────────────────────────────
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

  // ── Encryption ────────────────────────────────────────────────────────────
  const handleEnableEncryption = async () => {
    setEncError(''); setEncOk('')
    if (!encPw) { setEncError('Enter a password'); return }
    if (encPw !== encPwConf) { setEncError('Passwords do not match'); return }
    if (encPw.length < 8) { setEncError('Password must be at least 8 characters'); return }
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
    if (encPw !== encPwConf)   { setEncError('New passwords do not match'); return }
    if (encPw.length < 8)      { setEncError('Password must be at least 8 characters'); return }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md max-h-[90vh] rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">{t.settingsTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-card text-text-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">

          {/* ── General ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Globe className="w-3.5 h-3.5" />} label={t.settingsGeneral} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsLanguage}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['en', 'es'] as const).map((lang) => (
                  <button key={lang} onClick={() => updateSettings({ language: lang })} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', settings.language === lang ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary')}>
                    {lang === 'en' ? t.settingsLanguageEn : t.settingsLanguageEs}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Appearance ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Eye className="w-3.5 h-3.5" />} label={t.settingsAppearance} />
            <Toggle label={t.settingsShowReadingTime} value={settings.showReadingTime} onChange={(v) => updateSettings({ showReadingTime: v })} />
            <Toggle label={t.settingsCompactView}     value={settings.compactView}     onChange={(v) => updateSettings({ compactView: v })} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.settingsDefaultType}</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {types.map(({ value, label }) => (
                  <button key={value} onClick={() => updateSettings({ defaultItemType: value })} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', settings.defaultItemType === value ? 'bg-gold text-black' : 'bg-card text-text-secondary hover:text-text-primary')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Security ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} label="Security" />

            {isEncrypted ? (
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Your vault is encrypted with AES-256-GCM
                </div>

                {/* Auto-lock */}
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

                {/* Lock now */}
                <button onClick={() => { onClose(); lockApp() }} className="flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                  <Lock className="w-3.5 h-3.5" />
                  Lock now
                </button>

                {/* Change password */}
                <div className="flex flex-col gap-2 pt-1 border-t border-border">
                  <p className="text-[11px] text-text-muted">Change master password</p>
                  <input type="password" placeholder="Current password" value={encOldPw} onChange={(e) => setEncOldPw(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                  <input type="password" placeholder="New password (min. 8 chars)" value={encPw} onChange={(e) => setEncPw(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                  <input type="password" placeholder="Confirm new password" value={encPwConf} onChange={(e) => setEncPwConf(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                  <button onClick={handleChangePassword} className="self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
                    Change password
                  </button>
                </div>

                {/* Disable */}
                <div className="flex flex-col gap-2 pt-1 border-t border-border">
                  <p className="text-[11px] text-text-muted">Disable encryption (stores data unencrypted)</p>
                  <div className="flex gap-2">
                    <input type="password" placeholder="Current password to confirm" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                    <button onClick={handleDisableEncryption} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
                      <ShieldOff className="w-3.5 h-3.5" />
                      Disable
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-text-muted leading-relaxed">
                  Protect your vault with AES-256-GCM encryption. You'll need the password every time Hoard starts.
                </p>
                <input type="password" placeholder="Master password (min. 8 chars)" value={encPw} onChange={(e) => setEncPw(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                <input type="password" placeholder="Confirm password" value={encPwConf} onChange={(e) => setEncPwConf(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors" />
                <button onClick={handleEnableEncryption} className="flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-colors">
                  <Lock className="w-3.5 h-3.5" />
                  Enable encryption
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
              Export your entire vault (database + images) as a <span className="font-mono bg-card px-1 rounded text-text-secondary">.hoard</span> file you can import on any device.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={backupState === 'loading'}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border', backupState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}
              >
                {backupState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : backupState === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                {backupState === 'done' ? 'Exported ✓' : 'Export backup'}
              </button>
              <button
                onClick={handleImportBackup}
                disabled={backupState === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import backup
              </button>
            </div>
            {backupState === 'error' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Backup operation failed</p>}
          </section>

          {/* ── Import bookmarks ── */}
          <section className="px-5 py-4 flex flex-col gap-3">
            <SectionHeader icon={<Upload className="w-3.5 h-3.5" />} label="Import" />
            <p className="text-xs text-text-muted leading-relaxed">
              Import bookmarks from Chrome, Firefox, Edge or Safari. Export them as <span className="font-mono bg-card px-1 rounded text-text-secondary">.html</span> from your browser first.
            </p>
            <button
              onClick={handleImportBookmarks}
              disabled={importState === 'loading'}
              className={cn('flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium transition-all border', importState === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-card border-border text-text-secondary hover:text-text-primary disabled:opacity-50')}
            >
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

          {/* ── Data ── */}
          <section className="px-5 py-4 flex flex-col gap-3" onMouseEnter={loadDataPath}>
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label={t.settingsData} />
            <span className="text-xs text-text-muted">{t.settingsDataLocation}</span>
            <p className="text-[11px] text-text-secondary font-mono truncate">{dataPath ?? '…'}</p>
            <button onClick={() => window.api.settings.openDataFolder()} className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
              <Layers className="w-3.5 h-3.5" />
              {t.settingsOpenFolder}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-widest">
      {icon}{label}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-primary">{label}</span>
      <button onClick={() => onChange(!value)} className={cn('relative w-9 h-5 rounded-full transition-colors', value ? 'bg-gold' : 'bg-border')}>
        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', value ? 'translate-x-4' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}
