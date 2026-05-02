import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  vaults: {
    list:   ()                                          => ipcRenderer.invoke('vault:list'),
    create: (name: string, color: string)               => ipcRenderer.invoke('vault:create', name, color),
    update: (id: number, name: string, color: string)   => ipcRenderer.invoke('vault:update', id, name, color),
    delete: (id: number)                                => ipcRenderer.invoke('vault:delete', id)
  },

  folders: {
    list:   (vaultId: number)                                                        => ipcRenderer.invoke('folder:list', vaultId),
    create: (vaultId: number, name: string, parentId?: number, smartQuery?: string)  => ipcRenderer.invoke('folder:create', vaultId, name, parentId, smartQuery),
    update: (id: number, name: string, smartQuery?: string)                          => ipcRenderer.invoke('folder:update', id, name, smartQuery),
    delete: (id: number)                                                             => ipcRenderer.invoke('folder:delete', id)
  },

  items: {
    counts: (vaultId: number)                                                                      => ipcRenderer.invoke('item:counts', vaultId),
    list:   (params: unknown)                                                                      => ipcRenderer.invoke('item:list', params),
    create: (data: unknown)                                                                        => ipcRenderer.invoke('item:create', data),
    update: (id: number, data: unknown)                                                            => ipcRenderer.invoke('item:update', id, data),
    pin:    (id: number, pinned: boolean)                                                          => ipcRenderer.invoke('item:pin', id, pinned),
    delete: (id: number)                                                                           => ipcRenderer.invoke('item:delete', id),
    move:         (id: number, targetVaultId: number, targetFolderId?: number | null)    => ipcRenderer.invoke('item:move', id, targetVaultId, targetFolderId),
    copy:         (id: number, targetVaultId: number, targetFolderId?: number | null)    => ipcRenderer.invoke('item:copy', id, targetVaultId, targetFolderId),
    duplicate:    (id: number)                                                           => ipcRenderer.invoke('item:duplicate', id),
    folderCounts: (vaultId: number)                                                      => ipcRenderer.invoke('item:folder-counts', vaultId)
  },

  tags: {
    list:        (vaultId: number)                                   => ipcRenderer.invoke('tag:list', vaultId),
    create:      (vaultId: number, name: string, color: string)      => ipcRenderer.invoke('tag:create', vaultId, name, color),
    delete:      (id: number)                                        => ipcRenderer.invoke('tag:delete', id),
    setItemTags: (itemId: number, tagIds: number[])                  => ipcRenderer.invoke('tag:set-item', itemId, tagIds)
  },

  settings: {
    load:            ()                   => ipcRenderer.invoke('settings:load'),
    save:            (patch: unknown)     => ipcRenderer.invoke('settings:save', patch),
    getDataPath:     ()                   => ipcRenderer.invoke('settings:get-data-path'),
    openDataFolder:  ()                   => ipcRenderer.invoke('settings:open-data-folder')
  },

  util: {
    fetchMetadata:   (url: string)          => ipcRenderer.invoke('util:fetch-metadata', url),
    saveImage:       (filePath: string)     => ipcRenderer.invoke('util:save-image', filePath),
    openImageDialog: ()                     => ipcRenderer.invoke('util:open-image-dialog'),
    openUrl:         (url: string)          => ipcRenderer.invoke('util:open-url', url),
    exportImage:     (srcPath: string)      => ipcRenderer.invoke('util:export-image', srcPath),
    exportImages:    (srcPaths: string[])   => ipcRenderer.invoke('util:export-images', srcPaths)
  },

  bookmarks: {
    import: (vaultId: number) => ipcRenderer.invoke('bookmarks:import', vaultId)
  },

  security: {
    getStatus:         ()                                          => ipcRenderer.invoke('security:get-status'),
    unlock:            (password: string)                          => ipcRenderer.invoke('security:unlock', password),
    verifyPassword:    (password: string)                          => ipcRenderer.invoke('security:verify-password', password),
    enableEncryption:  (password: string)                          => ipcRenderer.invoke('security:enable-encryption', password),
    disableEncryption: (password: string)                          => ipcRenderer.invoke('security:disable-encryption', password),
    changePassword:    (oldPw: string, newPw: string)              => ipcRenderer.invoke('security:change-password', oldPw, newPw)
  },

  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import')
  },

  // Push events from main process → renderer
  on:  (channel: string, cb: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args)
    ipcRenderer.on(channel, handler)
    return handler
  },
  off: (channel: string, handler: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, handler as never)
  }
})

// touch
