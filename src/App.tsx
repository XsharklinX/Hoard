import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ItemGrid } from './components/ItemGrid'
import { AddItemModal } from './components/AddItemModal'
import { VaultModal } from './components/VaultModal'
import { FolderModal } from './components/FolderModal'
import { SettingsModal } from './components/SettingsModal'
import { PreviewPanel } from './components/PreviewPanel'
import { useStore } from './store'
import type { Vault } from './types'

export default function App() {
  const { loadVaults, selectedItem } = useStore()

  const [addOpen,      setAddOpen]      = useState(false)
  const [vaultOpen,    setVaultOpen]    = useState(false)
  const [folderOpen,   setFolderOpen]   = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editVault,    setEditVault]    = useState<Vault | null>(null)

  useEffect(() => { loadVaults() }, [])

  // ── Extension push: when the local server saves something, refresh the grid ──
  useEffect(() => {
    const handler = window.api.on('item:refresh', async () => {
      // Read state fresh every time so we never get stale vault/folder
      const { selectFolder, selectTag, selectType, loadCounts,
              selectedFolder, selectedTag, selectedType } = useStore.getState()
      await loadCounts()
      if (selectedFolder)   await selectFolder(selectedFolder)
      else if (selectedTag) await selectTag(selectedTag)
      else                  await selectType(selectedType)
    })
    return () => { window.api.off('item:refresh', handler) }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setAddOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar
        onNewVault={() => { setEditVault(null); setVaultOpen(true) }}
        onEditVault={(v) => { setEditVault(v); setVaultOpen(true) }}
        onNewFolder={() => setFolderOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <ItemGrid onAddItem={() => setAddOpen(true)} />

      {selectedItem && <PreviewPanel />}

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />

      <VaultModal
        open={vaultOpen}
        vault={editVault}
        onClose={() => { setVaultOpen(false); setEditVault(null) }}
      />

      <FolderModal    open={folderOpen}   onClose={() => setFolderOpen(false)} />
      <SettingsModal  open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
