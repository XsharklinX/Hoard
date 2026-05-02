import { useEffect, useRef, useState } from 'react'
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
import { useStore } from './store'
import type { Vault, Item } from './types'

export default function App() {
  const {
    loadVaults, selectedItem, checkSecurity, appLocked, unlock, lockApp, settings,
    updateArchiveStatus, selectFolder, selectTag, selectType, loadCounts,
    selectedFolder, selectedTag, selectedType
  } = useStore()

  const [addOpen,      setAddOpen]      = useState(false)
  const [vaultOpen,    setVaultOpen]    = useState(false)
  const [folderOpen,   setFolderOpen]   = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveOpen,     setMoveOpen]     = useState(false)
  const [paletteOpen,  setPaletteOpen]  = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [editingItem,  setEditingItem]  = useState<Item | null>(null)
  const [editVault,    setEditVault]    = useState<Vault | null>(null)
  const [appReady,     setAppReady]     = useState(false)

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
      await loadCounts()
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!appReady) return null
  if (appLocked) return <LockScreen onUnlock={handleUnlock} />

  return (
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
      <ConfirmDialog />
    </div>
  )
}
