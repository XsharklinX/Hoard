import { useMemo, useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Archive, Settings, Tag, Link as LinkIcon, FileText, Image as ImageIcon, Code, Sparkles, Pencil, Circle, Quote, Paperclip } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { useStore } from '../store'
import { useT } from '../i18n'
import { confirm } from '../lib/confirm'
import { toast } from '../lib/toast'
import type { Vault, Folder as FolderType } from '../types'
import { cn } from '../lib/utils'

interface SidebarProps {
  onNewVault:  () => void
  onEditVault: (vault: Vault) => void
  onNewFolder: () => void
  onSettings:  () => void
}

export function Sidebar({ onNewVault, onEditVault, onNewFolder, onSettings }: SidebarProps) {
  const {
    vaults, selectedVault, folders, selectedFolder, selectedTag, selectedType, itemCounts, folderCounts,
    tags, selectVault, selectFolder, selectTag, selectType, deleteVault, deleteFolder, deleteTag,
    updateVault, updateFolder, reorderFolders, items
  } = useStore()

  const unreadReadingTime = useMemo(() => {
    if (selectedType !== 'unread') return 0
    return items.reduce((sum, i) => sum + (i.type === 'link' ? (i.reading_time ?? 0) : 0), 0)
  }, [items, selectedType])

  const tagCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    items.forEach((item) => item.tags.forEach((tag) => {
      counts[tag.id] = (counts[tag.id] ?? 0) + 1
    }))
    return counts
  }, [items])
  const t = useT()

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [width, setWidth]             = useState(224)
  const [renameVaultId,  setRenameVaultId]  = useState<number | null>(null)
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null)
  const [renameValue,    setRenameValue]    = useState('')

  const rootFolders  = folders.filter((f) => f.parent_id === null)
  const childFolders = (parentId: number) => folders.filter((f) => f.parent_id === parentId)

  const toggleFolder = (id: number) =>
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const startRenameVault = (vault: Vault) => {
    setRenameVaultId(vault.id)
    setRenameValue(vault.name)
  }

  const commitRenameVault = async (vault: Vault) => {
    const name = renameValue.trim()
    if (name && name !== vault.name) await updateVault(vault.id, name, vault.color)
    setRenameVaultId(null)
  }

  const startRenameFolder = (folder: FolderType) => {
    setRenameFolderId(folder.id)
    setRenameValue(folder.name)
  }

  const commitRenameFolder = async (folder: FolderType) => {
    const name = renameValue.trim()
    if (name && name !== folder.name) await updateFolder(folder.id, name, folder.smart_query ?? undefined)
    setRenameFolderId(null)
  }

  const handleDeleteVault = async (e: React.MouseEvent | null, vault: Vault) => {
    e?.stopPropagation()
    if (vaults.length === 1) return
    if (await confirm(t.deleteVaultConfirm(vault.name))) {
      await deleteVault(vault.id)
      toast.success(t.toastVaultDeleted)
    }
  }

  const handleDeleteFolder = async (e: React.MouseEvent | null, folder: FolderType) => {
    e?.stopPropagation()
    if (await confirm(t.deleteFolderConfirm(folder.name))) {
      await deleteFolder(folder.id)
      toast.success(t.toastFolderDeleted)
    }
  }

  const handleDeleteTag = async (e: React.MouseEvent | null, tagId: number) => {
    e?.stopPropagation()
    if (await confirm(t.deleteTagConfirm)) {
      await deleteTag(tagId)
      toast.success(t.toastTagDeleted)
    }
  }

  const renderTypeFilter = (type: 'all' | 'link' | 'note' | 'image' | 'code' | 'unread', icon: React.ReactNode, label: string, count?: number, badge?: string) => {
    const isSelected = selectedType === type && !selectedFolder && !selectedTag
    return (
      <div
        className={cn(
          'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
          isSelected ? 'bg-gold/10 text-gold' : 'text-text-secondary hover:bg-card hover:text-text-primary'
        )}
        onClick={() => selectType(type)}
      >
        <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
        <div className="flex items-center gap-1.5">
          {badge && <span className="text-[10px] text-sky-400/70">{badge}</span>}
          {count != null && <span className="text-xs text-text-muted">{count}</span>}
        </div>
      </div>
    )
  }

  return (
    <Tooltip.Provider delayDuration={600}>
      <aside
        className="sidebar relative flex flex-col h-full shrink-0 border-r border-border bg-surface select-none"
        style={{ width }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <img src={new URL('../assets/icon.png', import.meta.url).href} alt="Hoard" className="w-8 h-8 rounded-lg object-contain shadow-sm drop-shadow-md" />
          <span className="font-bold text-lg text-text-primary tracking-wide">{t.appName}</span>
          <Tip label={t.settings}>
            <button
              onClick={onSettings}
              className="ml-auto p-1 rounded-md hover:bg-card text-text-muted hover:text-gold transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </Tip>
        </div>

        {/* Vaults */}
        <div className="px-3 pt-4 pb-1 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.vaults}</span>
            <Tip label={t.newVaultTitle}>
              <button onClick={onNewVault} className="p-0.5 rounded hover:bg-card text-text-muted hover:text-gold transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </Tip>
          </div>
          <div className="space-y-0.5">
            {vaults.map((vault) => (
              <ContextMenu.Root key={vault.id}>
                <ContextMenu.Trigger asChild>
                  <div
                    className={cn(
                      'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                      selectedVault?.id === vault.id ? 'bg-gold/10 text-gold' : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                    onClick={() => selectVault(vault)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vault.color }} />
                    {renameVaultId === vault.id ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm bg-transparent border-b border-gold/50 outline-none text-text-primary"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRenameVault(vault)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  { e.preventDefault(); commitRenameVault(vault) }
                          if (e.key === 'Escape') { setRenameVaultId(null) }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span
                          className="flex-1 text-sm truncate"
                          onDoubleClick={(e) => { e.stopPropagation(); startRenameVault(vault) }}
                        >
                          {vault.name}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          <Tip label="Rename">
                            <button onClick={(e) => { e.stopPropagation(); startRenameVault(vault) }} className="p-0.5 rounded hover:text-gold transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </Tip>
                          <Tip label={t.editVaultTitle}>
                            <button onClick={(e) => { e.stopPropagation(); onEditVault(vault) }} className="p-0.5 rounded hover:text-gold transition-colors">
                              <Settings className="w-3 h-3" />
                            </button>
                          </Tip>
                          {vaults.length > 1 && (
                            <Tip label="Delete vault">
                              <button onClick={(e) => handleDeleteVault(e, vault)} className="p-0.5 rounded hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </Tip>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content className="z-[300] min-w-[140px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
                    <ContextMenu.Item
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-card hover:text-text-primary cursor-pointer outline-none transition-colors"
                      onSelect={() => startRenameVault(vault)}
                    >
                      <Pencil className="w-3.5 h-3.5" />Rename
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-card hover:text-text-primary cursor-pointer outline-none transition-colors"
                      onSelect={() => onEditVault(vault)}
                    >
                      <Settings className="w-3.5 h-3.5" />Settings
                    </ContextMenu.Item>
                    {vaults.length > 1 && (
                      <>
                        <ContextMenu.Separator className="my-1 h-px bg-border" />
                        <ContextMenu.Item
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
                          onSelect={() => handleDeleteVault(null, vault)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />Delete Vault
                        </ContextMenu.Item>
                      </>
                    )}
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            ))}
          </div>
        </div>

        {/* Main Content */}
        {selectedVault && (
          <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 flex flex-col gap-6">

            {/* Types */}
            <div className="flex flex-col gap-0.5">
              {renderTypeFilter('all',    <Archive   className="w-3.5 h-3.5 shrink-0" />, t.allItems, itemCounts.all)}
              {renderTypeFilter('unread', <Circle    className="w-3.5 h-3.5 shrink-0 text-sky-400 fill-sky-400/40" />, 'Unread', undefined, unreadReadingTime > 0 ? `~${Math.ceil(unreadReadingTime / 60)}m` : undefined)}
              {renderTypeFilter('link',   <LinkIcon   className="w-3.5 h-3.5 shrink-0" />, 'Links',    itemCounts.link)}
              {renderTypeFilter('note',   <FileText   className="w-3.5 h-3.5 shrink-0" />, 'Notes',    itemCounts.note)}
              {renderTypeFilter('image',  <ImageIcon  className="w-3.5 h-3.5 shrink-0" />, 'Images',   itemCounts.image)}
              {renderTypeFilter('code',   <Code       className="w-3.5 h-3.5 shrink-0" />, 'Code',     itemCounts.code)}
              {itemCounts.quote > 0 && renderTypeFilter('quote', <Quote     className="w-3.5 h-3.5 shrink-0" />, 'Quotes',   itemCounts.quote)}
              {itemCounts.file  > 0 && renderTypeFilter('file',  <Paperclip className="w-3.5 h-3.5 shrink-0" />, 'Files',    itemCounts.file)}
            </div>

            {/* Folders */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.folders}</span>
                <Tip label={t.newFolderTitle}>
                  <button onClick={onNewFolder} className="p-0.5 rounded hover:bg-card text-text-muted hover:text-gold transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </Tip>
              </div>
              <DraggableFolderList
                folders={rootFolders}
                childFolders={childFolders}
                allFolders={folders}
                selected={selectedFolder}
                expanded={expandedFolders}
                folderCounts={folderCounts}
                renameId={renameFolderId}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameStart={startRenameFolder}
                onRenameCommit={commitRenameFolder}
                onRenameCancel={() => setRenameFolderId(null)}
                onSelect={(f) => { selectFolder(f) }}
                onToggle={toggleFolder}
                onDelete={handleDeleteFolder}
                onReorder={reorderFolders}
              />
              {folders.length === 0 && (
                <p className="text-[11px] text-text-muted mt-1 px-2">{t.noFolders}</p>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.tags}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={cn(
                        'group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors text-sm',
                        selectedTag?.id === tag.id ? 'bg-gold/10 text-gold' : 'text-text-secondary hover:bg-card hover:text-text-primary'
                      )}
                      onClick={() => { selectTag(tag) }}
                    >
                      <Tag className="w-3 h-3 shrink-0" style={{ color: tag.color }} />
                      <span className="flex-1 truncate">{tag.name}</span>
                      {tagCounts[tag.id] != null && (
                        <span className="text-[10px] text-text-muted group-hover:hidden">{tagCounts[tag.id]}</span>
                      )}
                      <button
                        onClick={(e) => handleDeleteTag(e, tag.id)}
                        className="hidden group-hover:block p-0.5 rounded hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resizer */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gold/50 transition-colors z-50"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.pageX, startW = width
            const onMove = (mv: MouseEvent) => setWidth(Math.max(180, Math.min(600, startW + mv.pageX - startX)))
            const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }}
        />
      </aside>
    </Tooltip.Provider>
  )
}

// ── Tooltip wrapper ────────────────────────────────────────────────────────────
function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right" sideOffset={6}
          className="z-[500] px-2 py-1 rounded-md text-xs bg-card border border-border text-text-primary shadow-lg"
        >
          {label}
          <Tooltip.Arrow className="fill-border" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

// ── Folder node ────────────────────────────────────────────────────────────────
interface FolderNodeProps {
  folder:         FolderType
  children:       FolderType[]
  allFolders:     FolderType[]
  selected:       FolderType | null
  expanded:       Set<number>
  folderCounts:   Record<number, number>
  renameId:       number | null
  renameValue:    string
  onRenameChange: (v: string) => void
  onRenameStart:  (f: FolderType) => void
  onRenameCommit: (f: FolderType) => void
  onRenameCancel: () => void
  onSelect:       (f: FolderType) => void
  onToggle:       (id: number) => void
  onDelete:       (e: React.MouseEvent, f: FolderType) => void
  depth?:         number
}

function FolderNode({
  folder, children, allFolders, selected, expanded, folderCounts,
  renameId, renameValue, onRenameChange, onRenameStart, onRenameCommit, onRenameCancel,
  onSelect, onToggle, onDelete, depth = 0
}: FolderNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const hasChildren = children.length > 0
  const isExpanded  = expanded.has(folder.id)
  const isSelected  = selected?.id === folder.id
  const isRenaming  = renameId === folder.id
  const grandChildren = (id: number) => allFolders.filter((f) => f.parent_id === id)

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true) }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false)
    const itemIdStr = e.dataTransfer.getData('hoard/item-id')
    if (itemIdStr) await useStore.getState().updateItem(parseInt(itemIdStr, 10), { folderId: folder.id })
  }

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={cn(
              'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
              isDragOver ? 'bg-gold/20 ring-1 ring-gold' : isSelected
                ? 'bg-gold/10 text-gold'
                : 'text-text-secondary hover:bg-card hover:text-text-primary'
            )}
            onClick={() => { if (!isRenaming) onSelect(folder) }}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {hasChildren ? (
              <button onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }} className="shrink-0">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            {folder.icon ? (
              <span className="text-sm shrink-0 leading-none">{folder.icon}</span>
            ) : folder.smart_query ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-gold" />
            ) : (
              isSelected || isDragOver ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />
            )}
            {isRenaming ? (
              <input
                autoFocus
                className="flex-1 text-sm bg-transparent border-b border-gold/50 outline-none text-text-primary"
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onBlur={() => onRenameCommit(folder)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  { e.preventDefault(); onRenameCommit(folder) }
                  if (e.key === 'Escape') { onRenameCancel() }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span
                  className="flex-1 truncate"
                  onDoubleClick={(e) => { e.stopPropagation(); onRenameStart(folder) }}
                >
                  {folder.name}
                </span>
                {folderCounts[folder.id] != null && (
                  <span className="text-[10px] text-text-muted group-hover:opacity-0 transition-opacity shrink-0">
                    {folderCounts[folder.id]}
                  </span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <Tip label="Rename">
                    <button onClick={(e) => { e.stopPropagation(); onRenameStart(folder) }} className="p-0.5 rounded hover:text-gold transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                  </Tip>
                  <Tip label="Delete">
                    <button onClick={(e) => onDelete(e, folder)} className="p-0.5 rounded hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Tip>
                </div>
              </>
            )}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="z-[300] min-w-[140px] bg-surface border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden">
            <ContextMenu.Item
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-card hover:text-text-primary cursor-pointer outline-none transition-colors"
              onSelect={() => onRenameStart(folder)}
            >
              <Pencil className="w-3.5 h-3.5" />Rename
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-border" />
            <ContextMenu.Item
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
              onSelect={() => onDelete(null as any, folder)}
            >
              <Trash2 className="w-3.5 h-3.5" />Delete Folder
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              children={grandChildren(child.id)}
              allFolders={allFolders}
              selected={selected}
              expanded={expanded}
              folderCounts={folderCounts}
              renameId={renameId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameStart={onRenameStart}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Draggable folder list ──────────────────────────────────────────────────────

interface DraggableFolderListProps {
  folders:        FolderType[]
  childFolders:   (parentId: number) => FolderType[]
  allFolders:     FolderType[]
  selected:       FolderType | null
  expanded:       Set<number>
  folderCounts:   Record<number, number>
  renameId:       number | null
  renameValue:    string
  onRenameChange: (v: string) => void
  onRenameStart:  (f: FolderType) => void
  onRenameCommit: (f: FolderType) => void
  onRenameCancel: () => void
  onSelect:       (f: FolderType) => void
  onToggle:       (id: number) => void
  onDelete:       (e: React.MouseEvent, f: FolderType) => void
  onReorder:      (orderedIds: number[]) => void
}

function DraggableFolderList(props: DraggableFolderListProps) {
  const { folders, onReorder, childFolders, ...nodeProps } = props
  const [order, setOrder] = useState<number[]>(folders.map((f) => f.id))
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const folderIdKey = useMemo(() => folders.map((f) => f.id).join(','), [folders])
  useEffect(() => { setOrder(folders.map((f) => f.id)) }, [folderIdKey])

  const orderedFolders = order.map((id) => folders.find((f) => f.id === id)).filter(Boolean) as FolderType[]

  const handleDragStart = (id: number) => setDraggingId(id)

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    // Only handle folder reorder drags (no item-id data)
    if (e.dataTransfer.types.includes('hoard/item-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(idx)
  }

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    if (draggingId === null || e.dataTransfer.types.includes('hoard/item-id')) return
    e.preventDefault()
    const fromIdx = order.indexOf(draggingId)
    if (fromIdx === -1 || fromIdx === toIdx) { setDraggingId(null); setOverIdx(null); return }
    const next = [...order]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, draggingId)
    setOrder(next)
    onReorder(next)
    setDraggingId(null)
    setOverIdx(null)
  }

  const handleDragEnd = () => { setDraggingId(null); setOverIdx(null) }

  return (
    <div>
      {orderedFolders.map((folder, idx) => (
        <div
          key={folder.id}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('hoard/folder-id', folder.id.toString()); handleDragStart(folder.id) }}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={cn(
            'rounded transition-colors',
            overIdx === idx && draggingId !== folder.id && 'ring-1 ring-gold/40 bg-gold/5',
            draggingId === folder.id && 'opacity-50'
          )}
        >
          <FolderNode
            folder={folder}
            children={childFolders(folder.id)}
            {...nodeProps}
            allFolders={nodeProps.allFolders}
          />
        </div>
      ))}
    </div>
  )
}
