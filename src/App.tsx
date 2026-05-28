import { useEffect, useRef, useState, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { toast } from './lib/toast'
import { Sidebar } from './components/Sidebar'
import { ItemGrid } from './components/ItemGrid'
import { AddItemModal } from './components/AddItemModal'
import { VaultModal } from './components/VaultModal'
import { FolderModal } from './components/FolderModal'
import { SettingsModal } from './components/SettingsModal'
import { PreviewPanel } from './components/PreviewPanel'
import { LockScreen } from './components/LockScreen'
import { MoveItemModal } from './components/MoveItemModal'
import { EditItemModal } from './components/EditItemModal'
import { CommandPalette } from './components/CommandPalette'
import { ConfirmDialog } from './components/ConfirmDialog'
import { WelcomeScreen } from './components/WelcomeScreen'
import { ImageLightbox } from './components/ImageLightbox'
import { ShortcutModal } from './components/ShortcutModal'
import { useStore } from './store'
import type { Vault, Item } from './types'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[Hoard crash]', error, info) }
  handleReset = () => {
    // Deselect any item that may have caused the crash before resetting
    useStore.getState().selectItem(null)
    this.setState({ error: null })
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
          <p className="text-text-muted text-xs font-mono max-w-xs break-all">{(this.state.error as Error).message}</p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-card border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const {
    loadVaults, selectedItem, checkSecurity, appLocked, unlock, lockApp, settings, updateSettings,
    updateArchiveStatus, updateLinkStatus, selectFolder, selectTag, selectType, loadCounts, reloadFolders,
    selectedFolder, selectedTag, selectedType, selectedVault, setAutoSummary
  } = useStore()

  const [addOpen,      setAddOpen]      = useState(false)
  const [vaultOpen,    setVaultOpen]    = useState(false)
  const [folderOpen,   setFolderOpen]   = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveOpen,     setMoveOpen]     = useState(false)
  const [paletteOpen,  setPaletteOpen]  = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [editingItem,  setEditingItem]  = useState<Item | null>(null)
  const [editVault,     setEditVault]     = useState<Vault | null>(null)
  const [appReady,      setAppReady]      = useState(false)
  const [showWelcome,   setShowWelcome]   = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ── Theme ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const theme = settings.theme ?? 'dark'
    document.documentElement.classList.remove('theme-light', 'theme-midnight')
    if (theme !== 'dark') document.documentElement.classList.add(`theme-${theme}`)
  }, [settings.theme])

  // ── Startup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await checkSecurity()
        const state = useStore.getState()
        if (!state.appLocked && state.vaults.length === 0) {
          await loadVaults()
        }
      } catch (err) {
        console.error('Failed to initialize app:', err)
      } finally {
        setAppReady(true)
        // Show welcome to first-time users (check after settings are loaded)
        const s = useStore.getState().settings
        if (!s.hasSeenWelcome) setShowWelcome(true)
      }
    }
    init()
  }, [])

  // ── Load vaults after unlock ───────────────────────────────────────────────
  const handleUnlock = async (password: string) => {
    return unlock(password)
  }

  // ── Auto-lock on inactivity ────────────────────────────────────────────────
  const lastActivityRef = useRef(Date.now())
  useEffect(() => {
    if (!settings.autoLockMinutes || settings.autoLockMinutes <= 0) return
    const reset = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    const interval = setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 60000
      if (idle >= settings.autoLockMinutes) lockApp()
    }, 15000)
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      clearInterval(interval)
    }
  }, [settings.autoLockMinutes])

  // ── Extension push: refresh grid on new save ───────────────────────────────
  useEffect(() => {
    const handler = window.api.on('item:refresh', async () => {
      await Promise.all([loadCounts(), reloadFolders()])
      if (selectedFolder)        await selectFolder(selectedFolder)
      else if (selectedTag)      await selectTag(selectedTag)
      else                       await selectType(selectedType)
    })
    return () => { window.api.off('item:refresh', handler) }
  }, [selectedFolder, selectedTag, selectedType])

  // ── Archive status push ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = window.api.on('item:archive-status', (payload: unknown) => {
      const { id, status, archivePath } = payload as { id: number; status: 'pending' | 'done' | 'failed'; archivePath?: string }
      updateArchiveStatus(id, status, archivePath)
    })
    return () => { window.api.off('item:archive-status', handler) }
  }, [])

  // ── Link status push ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = window.api.on('item:link-status', (payload: unknown) => {
      const { id, status } = payload as { id: number; status: 'ok' | 'dead' | 'unknown' }
      updateLinkStatus(id, status)
    })
    return () => { window.api.off('item:link-status', handler) }
  }, [])

  // ── Auto-summarize push ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = window.api.on('item:ai-summary', (payload: unknown) => {
      const { id, summary } = payload as { id: number; summary: string }
      useStore.getState().setAutoSummary(id, summary)
    })
    return () => { window.api.off('item:ai-summary', handler) }
  }, [])

  // ── Trigger dead link check on vault load ─────────────────────────────────
  useEffect(() => {
    if (!selectedVault) return
    const t = setTimeout(() => {
      window.api.items.checkLinks(selectedVault.id).catch(console.error)
    }, 5000)
    return () => clearTimeout(t)
  }, [selectedVault?.id])

  // ── Auto-updater push ──────────────────────────────────────────────────────
  useEffect(() => {
    const onAvailable  = (p: unknown) => toast.info(`Update ${(p as { version: string }).version} is downloading…`)
    const onDownloaded = (p: unknown) => toast.success(`Update ${(p as { version: string }).version} ready — restarts on quit`)
    const h1 = window.api.on('updater:available',  onAvailable)
    const h2 = window.api.on('updater:downloaded', onDownloaded)
    return () => { window.api.off('updater:available', h1); window.api.off('updater:downloaded', h2) }
  }, [])

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); setAddOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen((v) => !v) }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          setShortcutsOpen((v) => !v)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!appReady) return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0a0a]">
      <div className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
    </div>
  )
  if (appLocked) return <LockScreen onUnlock={handleUnlock} />

  return (
    <>
    <Tooltip.Provider delayDuration={600}>
    <ErrorBoundary>
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar
        onNewVault={() => { setEditVault(null); setVaultOpen(true) }}
        onEditVault={(v) => { setEditVault(v); setVaultOpen(true) }}
        onNewFolder={() => setFolderOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <ItemGrid
        onAddItem={() => setAddOpen(true)}
        onMoveItems={() => setMoveOpen(true)}
        onEditItem={(item) => { setEditingItem(item); setEditOpen(true) }}
      />

      {selectedItem && (
        <PreviewPanel onEdit={(item) => { setEditingItem(item); setEditOpen(true) }} />
      )}

      <AddItemModal  open={addOpen}      onClose={() => setAddOpen(false)} />
      <EditItemModal open={editOpen}     onClose={() => { setEditOpen(false); setEditingItem(null) }} item={editingItem} />
      <MoveItemModal open={moveOpen}     onClose={() => setMoveOpen(false)} />

      <VaultModal
        open={vaultOpen}
        vault={editVault}
        onClose={() => { setVaultOpen(false); setEditVault(null) }}
      />

      <FolderModal   open={folderOpen}   onClose={() => setFolderOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutModal  open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ConfirmDialog />
    </div>
    </ErrorBoundary>
    </Tooltip.Provider>

    <ImageLightbox />

    {showWelcome && (
      <WelcomeScreen onComplete={async () => {
        await updateSettings({ hasSeenWelcome: true })
        setShowWelcome(false)
        // If no vault exists yet, prompt to create one immediately
        if (useStore.getState().vaults.length === 0) {
          setEditVault(null)
          setVaultOpen(true)
        }
      }} />
    )}
    </>
  )
}
