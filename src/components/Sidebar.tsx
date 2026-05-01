import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Archive, Settings, Tag, Link as LinkIcon, FileText, Image as ImageIcon, Code, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { Vault, Folder as FolderType } from '../types'
import { cn } from '../lib/utils'

interface SidebarProps {
  onNewVault: () => void
  onEditVault: (vault: Vault) => void
  onNewFolder: () => void
  onSettings: () => void
}

export function Sidebar({ onNewVault, onEditVault, onNewFolder, onSettings }: SidebarProps) {
  const {
    vaults, selectedVault, folders, selectedFolder, selectedTag, selectedType, itemCounts,
    tags, selectVault, selectFolder, selectTag, selectType, deleteVault, deleteFolder, deleteTag
  } = useStore()
  const t = useT()

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [width, setWidth] = useState(224) // 56 * 4 = 224px (tailwind w-56)

  const rootFolders  = folders.filter((f) => f.parent_id === null)
  const childFolders = (parentId: number) => folders.filter((f) => f.parent_id === parentId)

  const toggleFolder = (id: number) =>
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleDeleteVault = async (e: React.MouseEvent, vault: Vault) => {
    e.stopPropagation()
    if (vaults.length === 1) return
    if (confirm(t.deleteVaultConfirm(vault.name))) await deleteVault(vault.id)
  }

  const handleDeleteFolder = async (e: React.MouseEvent, folder: FolderType) => {
    e.stopPropagation()
    if (confirm(t.deleteFolderConfirm(folder.name))) await deleteFolder(folder.id)
  }

  const handleDeleteTag = async (e: React.MouseEvent, tagId: number) => {
    e.stopPropagation()
    if (confirm(t.deleteTagConfirm)) await deleteTag(tagId)
  }

  // Helper for rendering a Type filter row
  const renderTypeFilter = (type: 'all' | 'link' | 'note' | 'image' | 'code', icon: React.ReactNode, label: string, count: number) => {
    const isSelected = selectedType === type && !selectedFolder && !selectedTag
    return (
      <div
        className={cn(
          'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
          isSelected
            ? 'bg-gold/10 text-gold'
            : 'text-text-secondary hover:bg-card hover:text-text-primary'
        )}
        onClick={() => selectType(type)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-xs text-text-muted">{count}</span>
      </div>
    )
  }

  return (
    <aside 
      className="sidebar relative flex flex-col h-full shrink-0 border-r border-border bg-surface select-none"
      style={{ width }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <img src={new URL('../assets/icon.png', import.meta.url).href} alt="Hoard" className="w-8 h-8 rounded-lg object-contain shadow-sm drop-shadow-md" />
        <span className="font-bold text-lg text-text-primary tracking-wide">{t.appName}</span>
        <button
          onClick={onSettings}
          className="ml-auto p-1 rounded-md hover:bg-card text-text-muted hover:text-gold transition-colors"
          title={t.settings}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Vaults */}
      <div className="px-3 pt-4 pb-1 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.vaults}</span>
          <button onClick={onNewVault} className="p-0.5 rounded hover:bg-card text-text-muted hover:text-gold transition-colors" title={t.newVault}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {vaults.map((vault) => (
            <div
              key={vault.id}
              className={cn(
                'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                selectedVault?.id === vault.id
                  ? 'bg-gold/10 text-gold'
                  : 'text-text-secondary hover:bg-card hover:text-text-primary'
              )}
              onClick={() => selectVault(vault)}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vault.color }} />
              <span className="flex-1 text-sm truncate">{vault.name}</span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); onEditVault(vault) }} className="p-0.5 rounded hover:text-gold transition-colors" title={t.editVaultTitle}>
                  <Settings className="w-3 h-3" />
                </button>
                {vaults.length > 1 && (
                  <button onClick={(e) => handleDeleteVault(e, vault)} className="p-0.5 rounded hover:text-red-400 transition-colors" title={t.deleteVaultTitle}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content (Types, Folders, Tags) */}
      {selectedVault && (
        <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 flex flex-col gap-6">
          
          {/* Types */}
          <div>
            <div className="flex flex-col gap-0.5">
              {renderTypeFilter('all', <Archive className="w-3.5 h-3.5 shrink-0" />, t.allItems, itemCounts.all)}
              {renderTypeFilter('link', <LinkIcon className="w-3.5 h-3.5 shrink-0" />, 'Links', itemCounts.link)}
              {renderTypeFilter('note', <FileText className="w-3.5 h-3.5 shrink-0" />, 'Notes', itemCounts.note)}
              {renderTypeFilter('image', <ImageIcon className="w-3.5 h-3.5 shrink-0" />, 'Images', itemCounts.image)}
              {renderTypeFilter('code', <Code className="w-3.5 h-3.5 shrink-0" />, 'Code', itemCounts.code)}
            </div>
          </div>

          {/* Folders */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.folders}</span>
              <button onClick={onNewFolder} className="p-0.5 rounded hover:bg-card text-text-muted hover:text-gold transition-colors" title={t.newFolderTitle}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                children={childFolders(folder.id)}
                allFolders={folders}
                selected={selectedFolder}
                expanded={expandedFolders}
                onSelect={(f) => { selectFolder(f); selectTag(null) }}
                onToggle={toggleFolder}
                onDelete={handleDeleteFolder}
              />
            ))}

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
                      selectedTag?.id === tag.id
                        ? 'bg-gold/10 text-gold'
                        : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                    onClick={() => { selectTag(tag); selectFolder(null) }}
                  >
                    <Tag className="w-3 h-3 shrink-0" style={{ color: tag.color }} />
                    <span className="flex-1 truncate">{tag.name}</span>
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

      {/* Resizer Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gold/50 transition-colors z-50"
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.pageX
          const startWidth = width
          const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(200, Math.min(600, startWidth + moveEvent.pageX - startX))
            setWidth(newWidth)
          }
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
          }
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        }}
      />
    </aside>
  )
}

// ── Folder node ───────────────────────────────────────────────────────────────

interface FolderNodeProps {
  folder: FolderType
  children: FolderType[]
  allFolders: FolderType[]
  selected: FolderType | null
  expanded: Set<number>
  onSelect: (f: FolderType) => void
  onToggle: (id: number) => void
  onDelete: (e: React.MouseEvent, f: FolderType) => void
  depth?: number
}

function FolderNode({ folder, children, allFolders, selected, expanded, onSelect, onToggle, onDelete, depth = 0 }: FolderNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const hasChildren = children.length > 0
  const isExpanded  = expanded.has(folder.id)
  const isSelected  = selected?.id === folder.id
  const grandChildren = (id: number) => allFolders.filter((f) => f.parent_id === id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const itemIdStr = e.dataTransfer.getData('hoard/item-id')
    if (itemIdStr) {
      await useStore.getState().updateItem(parseInt(itemIdStr, 10), { folderId: folder.id })
    }
  }

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
          isDragOver ? 'bg-gold/20 ring-1 ring-gold' : isSelected
            ? 'bg-gold/10 text-gold'
            : 'text-text-secondary hover:bg-card hover:text-text-primary'
        )}
        onClick={() => onSelect(folder)}
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
        {folder.smart_query 
          ? <Sparkles className="w-3.5 h-3.5 shrink-0 text-gold" />
          : (isSelected || isDragOver ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />)
        }
        <span className="flex-1 truncate">{folder.name}</span>
        <button
          onClick={(e) => onDelete(e, folder)}
          className="hidden group-hover:block p-0.5 rounded hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

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
