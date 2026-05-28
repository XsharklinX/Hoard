import { ipcMain, shell, dialog, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { vaultQueries, folderQueries, itemQueries, tagQueries, getImagesDir, CreateItemData,
         initDb, enableEncryption, disableEncryption, verifyPassword, hasEncryptedDb, isEncryptionEnabled,
         versionQueries, getUncheckedLinks, setLinkStatus } from './db'
import { loadSettings, saveSettings } from './settings'
import { sendToRenderer } from './window'
import { exportBackup, importBackup } from './backup'
import { processImageOcr } from './ocr'
import { archiveWebPage } from './archive'
import { startSyncWatcher, stopSyncWatcher } from './syncFolder'
import Jimp from 'jimp'

let _needsPassword = false
export function setNeedsPassword(v: boolean): void { _needsPassword = v }

export function registerHandlers(): void {
  // ── Vaults ──────────────────────────────────────────────────────────────────
  ipcMain.handle('vault:list',   ()                                        => vaultQueries.list())
  ipcMain.handle('vault:create', (_e, name: string, color: string)         => vaultQueries.create(name, color))
  ipcMain.handle('vault:update', (_e, id: number, name: string, color: string) => vaultQueries.update(id, name, color))
  ipcMain.handle('vault:delete', (_e, id: number)                          => { vaultQueries.delete(id) })

  // ── Folders ─────────────────────────────────────────────────────────────────
  ipcMain.handle('folder:list',    (_e, vaultId: number)                                                              => folderQueries.list(vaultId))
  ipcMain.handle('folder:create',  (_e, vaultId: number, name: string, parentId?: number, smartQuery?: string, icon?: string) => folderQueries.create(vaultId, name, parentId, smartQuery, icon))
  ipcMain.handle('folder:update',  (_e, id: number, name: string, smartQuery?: string, icon?: string)                         => folderQueries.update(id, name, smartQuery, icon))
  ipcMain.handle('folder:reorder', (_e, orderedIds: number[])                                                                  => { folderQueries.reorder(orderedIds) })
  ipcMain.handle('folder:delete',  (_e, id: number)                                                                           => { folderQueries.delete(id) })

  // ── Items ────────────────────────────────────────────────────────────────────
  ipcMain.handle('item:counts', (_e, vaultId: number) => itemQueries.counts(vaultId))
  ipcMain.handle('item:list',   (_e, params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: string | null }) => itemQueries.list(params))
  ipcMain.handle('item:create', (_e, data: CreateItemData) => {
    const item = itemQueries.create(data)
    if (data.type === 'image' && data.imagePath) {
      processImageOcr(item.id, data.imagePath)
    } else if (data.type === 'link' && data.url) {
      // Archive runs in background — no await
      archiveWebPage(item.id, data.url).catch(console.error)
      const s = loadSettings()
      if (s.aiProvider !== 'none') {
        const text = (data.content ?? data.title ?? data.url ?? '').slice(0, 4000)
        performSummarize({ text, provider: s.aiProvider, ollamaUrl: s.aiOllamaUrl, ollamaModel: s.aiOllamaModel, claudeApiKey: s.aiClaudeApiKey, geminiApiKey: s.aiGeminiApiKey })
          .then(res => { if (res.summary) sendToRenderer('item:ai-summary', { id: item.id, summary: res.summary }) })
          .catch(console.error)
      }
    }
    return item
  })
  ipcMain.handle('item:update',      (_e, id: number, data: Partial<CreateItemData>) => itemQueries.update(id, data))
  ipcMain.handle('item:pin',         (_e, id: number, pinned: boolean)               => { itemQueries.pin(id, pinned) })
  ipcMain.handle('item:delete',      (_e, id: number)                                => { itemQueries.delete(id) })
  ipcMain.handle('item:set-read',    (_e, id: number, status: 'unread' | 'read')     => itemQueries.update(id, { readStatus: status }))
  ipcMain.handle('item:search-items',  (_e, vaultId: number, q: string) => itemQueries.searchForLink(vaultId, q))
  ipcMain.handle('item:search-global', (_e, q: string)                  => itemQueries.searchGlobal(q))
  ipcMain.handle('item:tag-selected',(_e, ids: number[], tagIds: number[])           => {
    for (const id of ids) itemQueries.update(id, { tagIds })
  })
  ipcMain.handle('item:open-reader', (_e, archivePath: string, title: string)        => {
    openReaderWindow(archivePath, title)
  })

  // ── Version history ──────────────────────────────────────────────────────────
  ipcMain.handle('item:versions-list',    (_e, itemId: number)       => versionQueries.list(itemId))
  ipcMain.handle('item:version-get',      (_e, versionId: number)    => versionQueries.get(versionId))
  ipcMain.handle('item:version-save',     (_e, itemId: number, content: string) => { versionQueries.save(itemId, content) })

  // ── Dead link checker ────────────────────────────────────────────────────────
  ipcMain.handle('item:check-links', async (_e, vaultId: number) => {
    const links = getUncheckedLinks(vaultId)
    let checked = 0
    for (const link of links) {
      const status = await checkLinkAlive(link.url)
      setLinkStatus(link.id, status)
      sendToRenderer('item:link-status', { id: link.id, status })
      checked++
    }
    return { checked }
  })

  // ── Tags ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('tag:list',         (_e, vaultId: number)                           => tagQueries.list(vaultId))
  ipcMain.handle('tag:create',       (_e, vaultId: number, name: string, color: string) => tagQueries.create(vaultId, name, color))
  ipcMain.handle('tag:delete',       (_e, id: number)                                => { tagQueries.delete(id) })
  ipcMain.handle('tag:set-item',     (_e, itemId: number, tagIds: number[])          => { tagQueries.setItemTags(itemId, tagIds) })

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_e, patch: any) => {
    const updated = saveSettings(patch)
    // Only register with OS login items in packaged builds — in dev the exe path
    // would point to the Electron binary, not the installed app.
    if (patch.launchAtStartup !== undefined && app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: !!patch.launchAtStartup })
    }
    // Restart sync watcher if sync settings changed
    if (patch.syncFolderEnabled !== undefined || patch.syncFolderPath !== undefined) {
      const fresh = loadSettings()
      if (fresh.syncFolderEnabled && fresh.syncFolderPath) {
        startSyncWatcher(fresh.syncFolderPath)
      } else {
        stopSyncWatcher()
      }
    }
    return updated
  })
  ipcMain.handle('settings:get-data-path',    () => app.getPath('userData'))
  ipcMain.handle('settings:open-data-folder', () => { shell.openPath(app.getPath('userData')) })
  ipcMain.handle('settings:choose-backup-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose auto-backup folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  // ── Utilities ────────────────────────────────────────────────────────────────
  ipcMain.handle('util:fetch-metadata', async (_e, url: string) => fetchUrlMetadata(url))

  ipcMain.handle('util:save-image', async (_e, srcPath: string) => {
    const imagesDir = getImagesDir()
    const destPath = path.join(imagesDir, `${Date.now()}.jpg`) // Force jpg for compression

    try {
      const img = await Jimp.read(srcPath)
      
      // If image is larger than 1920x1080, scale it down proportionally
      if (img.bitmap.width > 1920 || img.bitmap.height > 1920) {
        img.scaleToFit(1920, 1920)
      }
      
      // Compress to 80% quality JPEG
      await img.quality(80).writeAsync(destPath)
      return destPath
    } catch (err) {
      console.error('Failed to compress image, copying original:', err)
      const ext = path.extname(srcPath) || '.png'
      const fallbackPath = path.join(imagesDir, `${Date.now()}${ext}`)
      fs.copyFileSync(srcPath, fallbackPath)
      return fallbackPath
    }
  })

  ipcMain.handle('util:open-image-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }]
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('util:open-url', (_e, url: string) => { shell.openExternal(url) })

  // ── Image export ──────────────────────────────────────────────────────────────
  ipcMain.handle('util:export-image', async (_e, srcPath: string) => {
    if (!fs.existsSync(srcPath)) return { cancelled: true }
    const ext  = path.extname(srcPath) || '.jpg'
    const base = path.basename(srcPath, ext)
    const win = require('electron').BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win || undefined as any, {
      title: 'Save image',
      defaultPath: `${base}${ext}`,
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    })
    if (result.canceled || !result.filePath) return { cancelled: true }
    fs.copyFileSync(srcPath, result.filePath)
    return { success: true, filePath: result.filePath }
  })

  ipcMain.handle('util:export-images', async (_e, srcPaths: string[]) => {
    const existing = srcPaths.filter((p) => fs.existsSync(p))
    if (!existing.length) return { cancelled: true }
    const win = require('electron').BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win || undefined as any, {
      title: 'Choose folder to save images',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths.length) return { cancelled: true }
    const destDir = result.filePaths[0]
    let copied = 0
    for (const src of existing) {
      const base = path.basename(src)
      const dest = path.join(destDir, base)
      try { fs.copyFileSync(src, dest); copied++ } catch { /* skip */ }
    }
    return { success: true, copied, folder: destDir }
  })

  // ── Bookmarks import ────────────────────────────────────────────────────────
  ipcMain.handle('bookmarks:import', async (_e, vaultId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Select bookmarks file',
      filters: [
        { name: 'Bookmarks / Highlights', extensions: ['html', 'htm', 'csv'] },
        { name: 'HTML Bookmarks', extensions: ['html', 'htm'] },
        { name: 'CSV (Raindrop / Readwise)', extensions: ['csv'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { count: 0, cancelled: true }

    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase()
    const text = fs.readFileSync(filePath, 'utf-8')

    if (ext === '.csv') {
      const lines = text.split('\n').filter(l => l.trim())
      if (!lines.length) return { count: 0 }
      const header = lines[0].toLowerCase()

      if (header.includes('highlight')) {
        // Readwise CSV
        const headerCols = parseCsvRow(lines[0])
        const highlightIdx  = headerCols.findIndex(c => c.trim().toLowerCase() === 'highlight')
        const bookTitleIdx  = headerCols.findIndex(c => c.trim().toLowerCase() === 'book title')
        const bookAuthorIdx = headerCols.findIndex(c => c.trim().toLowerCase() === 'book author')
        let count = 0
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvRow(lines[i])
          const highlight  = highlightIdx  >= 0 ? (cols[highlightIdx]  ?? '').trim() : ''
          const bookTitle  = bookTitleIdx  >= 0 ? (cols[bookTitleIdx]  ?? '').trim() : ''
          const bookAuthor = bookAuthorIdx >= 0 ? (cols[bookAuthorIdx] ?? '').trim() : ''
          if (!highlight) continue
          const title = bookTitle || 'Readwise Highlight'
          const content = [bookTitle && `Book: ${bookTitle}`, bookAuthor && `Author: ${bookAuthor}`, '', highlight].filter(s => s !== false).join('\n').trim()
          itemQueries.create({ vaultId, type: 'note', title, content })
          count++
        }
        sendToRenderer('bookmarks:progress', { done: count, total: count, finished: true })
        return { count }
      } else {
        // Raindrop.io CSV
        const headerCols = parseCsvRow(lines[0])
        const urlIdx   = headerCols.findIndex(c => c.trim().toLowerCase() === 'url')
        const titleIdx = headerCols.findIndex(c => c.trim().toLowerCase() === 'title')
        if (urlIdx < 0) return { count: 0 }
        const bookmarks: { url: string; title: string }[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvRow(lines[i])
          const url   = urlIdx   >= 0 ? (cols[urlIdx]   ?? '').trim() : ''
          const title = titleIdx >= 0 ? (cols[titleIdx] ?? '').trim() : ''
          if (!url || !url.startsWith('http')) continue
          bookmarks.push({ url, title: title || url })
        }

        for (const bm of bookmarks) {
          itemQueries.create({ vaultId, type: 'link', url: bm.url, title: bm.title })
        }

        const enrichQueue = [...bookmarks.map((_, i) => i)]
        const enriched = itemQueries.list({ vaultId }).slice(-bookmarks.length).reverse() as unknown as
          Array<{ id: number; url: string | null; title: string | null }>
        let enrichedCount = 0
        const total = bookmarks.length

        async function runPoolRaindrop(concurrency: number) {
          const worker = async () => {
            while (enrichQueue.length) {
              const idx = enrichQueue.shift()!
              const item = enriched[idx]
              if (!item?.url) continue
              try {
                const meta = await fetchUrlMetadata(item.url)
                itemQueries.update(item.id, {
                  title: (meta.title !== item.url ? meta.title : undefined) || item.title || undefined,
                  content: meta.description,
                  favicon: meta.favicon,
                  readingTime: meta.readingTime,
                  imagePath: meta.thumbnailPath
                })
              } catch { /* skip */ }
              enrichedCount++
              sendToRenderer('bookmarks:progress', { done: enrichedCount, total })
            }
          }
          await Promise.all(Array.from({ length: concurrency }, worker))
          sendToRenderer('bookmarks:progress', { done: total, total, finished: true })
        }

        runPoolRaindrop(5).catch(console.error)
        return { count: bookmarks.length }
      }
    }

    // HTML bookmarks (default)
    const bookmarks = parseNetscapeBookmarks(text)

    // Bulk insert without enrichment first — fast
    for (const bm of bookmarks) {
      itemQueries.create({ vaultId, type: 'link', url: bm.url, title: bm.title })
    }

    // Throttled background enrichment: 5 concurrent requests max
    const enrichQueue = [...bookmarks.map((_, i) => i)]
    const enriched = itemQueries.list({ vaultId }).slice(-bookmarks.length).reverse() as unknown as
      Array<{ id: number; url: string | null; title: string | null }>

    let enrichedCount = 0
    const total = bookmarks.length

    async function runPool(concurrency: number) {
      const worker = async () => {
        while (enrichQueue.length) {
          const idx = enrichQueue.shift()!
          const item = enriched[idx]
          if (!item?.url) continue
          try {
            const meta = await fetchUrlMetadata(item.url)
            itemQueries.update(item.id, {
              title: (meta.title !== item.url ? meta.title : undefined) || item.title || undefined,
              content: meta.description,
              favicon: meta.favicon,
              readingTime: meta.readingTime,
              imagePath: meta.thumbnailPath
            })
          } catch { /* skip silently */ }
          enrichedCount++
          sendToRenderer('bookmarks:progress', { done: enrichedCount, total })
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker))
      sendToRenderer('bookmarks:progress', { done: total, total, finished: true })
    }

    // Fire and forget — don't block the IPC response
    runPool(5).catch(console.error)

    return { count: bookmarks.length }
  })

  // ── Security ─────────────────────────────────────────────────────────────────
  ipcMain.handle('security:get-status', () => ({
    locked:            _needsPassword,
    encryptionEnabled: isEncryptionEnabled(),
    hasEncryptedDb:    hasEncryptedDb()
  }))

  ipcMain.handle('security:unlock', async (_e, password: string) => {
    const result = await initDb(password)
    if (!result.needsPassword) {
      _needsPassword = false
      return { success: true }
    }
    return { success: false, error: 'Wrong password' }
  })

  ipcMain.handle('security:verify-password', (_e, password: string) =>
    verifyPassword(password)
  )

  ipcMain.handle('security:enable-encryption', (_e, password: string) => {
    enableEncryption(password)
    saveSettings({ encryptionEnabled: true })
    return { success: true }
  })

  ipcMain.handle('security:disable-encryption', (_e, password: string) => {
    if (!verifyPassword(password)) return { success: false, error: 'Wrong password' }
    disableEncryption()
    saveSettings({ encryptionEnabled: false })
    return { success: true }
  })

  ipcMain.handle('security:change-password', (_e, oldPassword: string, newPassword: string) => {
    if (!verifyPassword(oldPassword)) return { success: false, error: 'Wrong password' }
    enableEncryption(newPassword)
    return { success: true }
  })

  // ── Backup ───────────────────────────────────────────────────────────────────
  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Hoard Backup',
      defaultPath: `hoard-backup-${new Date().toISOString().slice(0, 10)}.hoard`,
      filters: [{ name: 'Hoard Backup', extensions: ['hoard'] }]
    })
    if (result.canceled || !result.filePath) return { cancelled: true }
    exportBackup(result.filePath)
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Hoard Backup',
      filters: [{ name: 'Hoard Backup', extensions: ['hoard'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { cancelled: true }
    importBackup(result.filePaths[0])
    return { success: true }
  })

  // ── App info & updater ───────────────────────────────────────────────────────
  // ── Vault HTML/JSON export ─────────────────────────────────────────────────
  ipcMain.handle('backup:export-html', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export vault as HTML',
      defaultPath: `hoard-vault-${new Date().toISOString().slice(0, 10)}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (result.canceled || !result.filePath) return { cancelled: true }
    try {
      const vaults = vaultQueries.list() as Array<{ id: number; name: string; color: string }>
      const allItems: unknown[] = []
      for (const v of vaults) {
        const items = itemQueries.list({ vaultId: v.id }) as unknown[]
        allItems.push(...(items as Array<Record<string, unknown>>).map(i => ({ ...i, vaultName: v.name })))
      }
      const html = generateVaultHtml(allItems as VaultHtmlItem[], vaults)
      fs.writeFileSync(result.filePath, html, 'utf-8')
      return { success: true, path: result.filePath }
    } catch (err: unknown) { return { error: (err as Error).message } }
  })

  ipcMain.handle('backup:export-json', async (_e, folderPath: string) => {
    try {
      if (!fs.existsSync(folderPath)) return { error: 'Folder does not exist' }
      const vaults = vaultQueries.list() as Array<{ id: number; name: string }>
      let count = 0
      for (const v of vaults) {
        const items = itemQueries.list({ vaultId: v.id })
        const folders = folderQueries.list(v.id)
        const tags = tagQueries.list(v.id)
        const data = { vault: v, items, folders, tags, exportedAt: new Date().toISOString() }
        const safeName = v.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
        fs.writeFileSync(path.join(folderPath, `hoard-${safeName}.json`), JSON.stringify(data, null, 2), 'utf-8')
        count += (items as unknown[]).length
      }
      return { success: true, count }
    } catch (err: unknown) { return { error: (err as Error).message } }
  })

  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('app:check-updates', async () => {
    if (!app.isPackaged) return { error: 'dev' }
    try {
      await autoUpdater.checkForUpdates()
      return {}
    } catch (err: any) {
      return { error: err.message ?? 'failed' }
    }
  })

  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('app:close-window', () => {
    const win = BrowserWindow.getFocusedWindow()
    win?.close()
  })

  ipcMain.handle('app:open-extension-folder', () => {
    const extPath = app.isPackaged
      ? path.join(process.resourcesPath, 'extension')
      : path.join(app.getAppPath(), 'extension')
    
    if (fs.existsSync(extPath)) {
      shell.openPath(extPath)
    } else {
      // Fallback: open the resources/app folder so they can see where it should be
      const fallback = app.isPackaged ? process.resourcesPath : app.getAppPath()
      shell.openPath(fallback)
      console.error(`Extension folder not found at: ${extPath}. Opening fallback: ${fallback}`)
    }
  })

  // ── AI summarize ─────────────────────────────────────────────────────────────
  ipcMain.handle('ai:summarize', async (_e, params: {
    text: string
    provider: string
    ollamaUrl?: string
    ollamaModel?: string
    claudeApiKey?: string
    geminiApiKey?: string
  }) => {
    return performSummarize(params)
  })

  // ── Item move / copy ─────────────────────────────────────────────────────────
  ipcMain.handle('item:move', (_e, id: number, targetVaultId: number, targetFolderId?: number | null) =>
    itemQueries.move(id, targetVaultId, targetFolderId)
  )

  ipcMain.handle('item:copy', (_e, id: number, targetVaultId: number, targetFolderId?: number | null) =>
    itemQueries.copy(id, targetVaultId, targetFolderId)
  )

  ipcMain.handle('item:duplicate', (_e, id: number) =>
    itemQueries.duplicate(id)
  )

  ipcMain.handle('item:folder-counts', (_e, vaultId: number) =>
    itemQueries.folderCounts(vaultId)
  )
}

// ── CSV parser helper ─────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const result: string[] = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// ── AI summarize (extracted for reuse) ───────────────────────────────────────

export async function performSummarize(params: {
  text: string
  provider: string
  ollamaUrl?: string
  ollamaModel?: string
  claudeApiKey?: string
  geminiApiKey?: string
}): Promise<{ summary?: string; error?: string }> {
  const { text, provider, ollamaUrl = 'http://localhost:11434', ollamaModel = 'llama3', claudeApiKey = '' } = params
  const prompt = `Summarize the following content in 2-3 concise sentences:\n\n${text.slice(0, 4000)}`

  if (provider === 'ollama') {
    return await new Promise<{ summary?: string; error?: string }>((resolve) => {
      let parsedUrl: URL
      try { parsedUrl = new URL(`${ollamaUrl}/api/generate`) }
      catch { resolve({ error: 'Invalid Ollama URL' }); return }

      const body = JSON.stringify({ model: ollamaModel, prompt, stream: false })
      const options = {
        hostname: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '11434'),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }
      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => { data += c.toString() })
        res.on('end', () => {
          try { resolve({ summary: JSON.parse(data).response }) }
          catch { resolve({ error: 'Invalid response from Ollama' }) }
        })
      })
      req.on('error', (err) => resolve({ error: err.message }))
      req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'Timeout — is Ollama running?' }) })
      req.write(body)
      req.end()
    })
  }

  if (provider === 'gemini') {
    const geminiApiKey = params.geminiApiKey ?? ''
    if (!geminiApiKey) return { error: 'No Gemini API key configured' }
    return await new Promise<{ summary?: string; error?: string }>((resolve) => {
      const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      const apiPath = `/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: apiPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => { data += c.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.error) {
              resolve({ error: `Gemini: ${json.error.message ?? json.error.status ?? 'Unknown error'}` })
              return
            }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text
            if (!text) resolve({ error: 'Gemini returned no content — check your API key and quota' })
            else resolve({ summary: text })
          } catch { resolve({ error: 'Invalid response from Gemini' }) }
        })
      })
      req.on('error', (err) => resolve({ error: err.message }))
      req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'Timeout' }) })
      req.write(body)
      req.end()
    })
  }

  if (provider === 'claude') {
    if (!claudeApiKey) return { error: 'No Claude API key configured' }
    return await new Promise<{ summary?: string; error?: string }>((resolve) => {
      const body = JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => { data += c.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.error) { resolve({ error: `Claude: ${json.error.message ?? json.error.type ?? 'Unknown error'}` }); return }
            const text = json.content?.[0]?.text
            if (!text) resolve({ error: 'Claude returned no content — check your API key' })
            else resolve({ summary: text })
          } catch { resolve({ error: 'Invalid response from Claude' }) }
        })
      })
      req.on('error', (err) => resolve({ error: err.message }))
      req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'Timeout' }) })
      req.write(body)
      req.end()
    })
  }

  return { error: 'No AI provider configured' }
}

// ── Reader window ─────────────────────────────────────────────────────────────
function openReaderWindow(archivePath: string, title: string): void {
  const win = new BrowserWindow({
    width: 860,
    height: 900,
    title: `Reader — ${title}`,
    backgroundColor: '#0f0f0f',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  win.loadURL(`file:///${archivePath.replace(/\\/g, '/')}`)

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      *{box-sizing:border-box}
      html,body{background:#0f0f0f!important;color:#d4d4d4!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;max-width:700px!important;margin:0 auto!important;padding:24px 20px!important;font-size:17px!important;line-height:1.75!important}
      a{color:#7eb8f7!important}
      img{max-width:100%!important;border-radius:8px}
      pre,code{background:#1a1a1a!important;color:#ccc!important;border-radius:6px;padding:2px 6px;font-size:14px}
      pre{padding:16px!important;overflow:auto}
      h1,h2,h3,h4{color:#f0f0f0!important;font-weight:600}
      blockquote{border-left:3px solid #555;margin-left:0;padding-left:16px;color:#999!important}
      ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
    `)
  })
}

// Parse Netscape HTML bookmark format (Chrome, Firefox, Edge, Safari all use this)
function parseNetscapeBookmarks(html: string): { url: string; title: string }[] {
  const results: { url: string; title: string }[] = []
  // Match <A HREF="url">title</A> — case insensitive, attributes in any order
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const url   = m[1].trim()
    const title = m[2].trim()
    // Skip browser internal URLs
    if (!url || url.startsWith('javascript:') || url.startsWith('place:') || url.startsWith('about:')) continue
    results.push({ url, title: title || url })
  }
  return results
}


// ── Vault HTML export helper ──────────────────────────────────────────────────
interface VaultHtmlItem {
  id: number; type: string; title: string | null; url: string | null
  content: string | null; created_at: number; vaultName: string
  tags?: Array<{ name: string; color: string }>; code_lang?: string | null
}

function generateVaultHtml(items: VaultHtmlItem[], vaults: Array<{ name: string; color: string }>): string {
  const dataJson = JSON.stringify(items.map(i => ({
    id: i.id, type: i.type,
    title: i.title || i.url || 'Untitled',
    url: i.url || '',
    snippet: (i.content || '').replace(/<[^>]+>/g, ' ').slice(0, 200),
    vault: i.vaultName,
    date: new Date(i.created_at * 1000).toLocaleDateString(),
    tags: (i.tags || []).map(t => t.name).join(', '),
    lang: i.code_lang || ''
  })))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hoard — Vault Export</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#e4e4e4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;padding:24px 16px}
h1{font-size:1.4rem;font-weight:700;margin-bottom:4px;color:#fff}.subtitle{color:#555;font-size:.8rem;margin-bottom:20px}
.controls{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
input{flex:1;min-width:200px;padding:8px 12px;background:#1c1c1c;border:1px solid #252525;border-radius:8px;color:#e4e4e4;font-size:.85rem;outline:none}
input:focus{border-color:#c9952a55}
.filter-btn{padding:6px 14px;border-radius:8px;border:1px solid #252525;background:#1c1c1c;color:#888;font-size:.75rem;cursor:pointer;transition:all .15s}
.filter-btn.active,.filter-btn:hover{background:#c9952a22;color:#c9952a;border-color:#c9952a44}
.count{color:#555;font-size:.8rem;margin-bottom:12px}.count span{color:#c9952a}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.card{background:#141414;border:1px solid #1e1e1e;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s}
.card:hover{border-color:#252525}
.type-badge{display:inline-flex;padding:2px 8px;border-radius:99px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;width:fit-content}
.badge-link{background:#1d3044;color:#7eb8f7}
.badge-note{background:#102818;color:#6ee7b7}
.badge-image{background:#221030;color:#c084fc}
.badge-code{background:#2a1c06;color:#fbbf24}
.card-title{font-size:.9rem;font-weight:600;color:#e4e4e4;line-height:1.3;word-break:break-word}
.card-title a{color:inherit;text-decoration:none}.card-title a:hover{color:#c9952a}
.card-snippet{font-size:.75rem;color:#666;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:auto}
.card-date{font-size:.7rem;color:#444}
.card-tags{font-size:.7rem;color:#888}
.card-vault{font-size:.7rem;padding:2px 6px;background:#1c1c1c;border-radius:4px;color:#666}
.empty{text-align:center;padding:60px 20px;color:#444;font-size:.9rem}
</style>
</head>
<body>
<h1>🐉 Hoard</h1>
<p class="subtitle">Exported ${new Date().toLocaleDateString()} · ${items.length} items · ${vaults.map(v => v.name).join(', ')}</p>
<div class="controls">
  <input id="search" type="text" placeholder="Search…" oninput="filter()">
  <button class="filter-btn active" onclick="setType('',this)">All</button>
  <button class="filter-btn" onclick="setType('link',this)">Links</button>
  <button class="filter-btn" onclick="setType('note',this)">Notes</button>
  <button class="filter-btn" onclick="setType('image',this)">Images</button>
  <button class="filter-btn" onclick="setType('code',this)">Code</button>
</div>
<p class="count"><span id="cnt">${items.length}</span> items</p>
<div class="grid" id="grid"></div>
<script>
const DATA=${dataJson};
let typeFilter='';
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function renderCard(i){
  const href=i.url?'<a href="'+esc(i.url)+'" target="_blank" rel="noopener">'+esc(i.title)+'</a>':esc(i.title)
  return '<div class="card">'+
    '<span class="type-badge badge-'+i.type+'">'+i.type+'</span>'+
    '<div class="card-title">'+href+'</div>'+
    (i.snippet?'<div class="card-snippet">'+esc(i.snippet)+'</div>':'')+
    '<div class="card-meta">'+
    '<span class="card-date">'+i.date+'</span>'+
    (i.tags?'<span class="card-tags">'+esc(i.tags)+'</span>':'')+
    '<span class="card-vault">'+esc(i.vault)+'</span>'+
    '</div></div>'
}
function filter(){
  const q=document.getElementById('search').value.toLowerCase()
  const shown=DATA.filter(i=>
    (!typeFilter||i.type===typeFilter)&&
    (!q||i.title.toLowerCase().includes(q)||i.url.toLowerCase().includes(q)||i.snippet.toLowerCase().includes(q))
  )
  document.getElementById('cnt').textContent=shown.length
  const g=document.getElementById('grid')
  if(!shown.length){g.innerHTML='<div class="empty">No items found</div>';return}
  g.innerHTML=shown.map(renderCard).join('')
}
function setType(t,btn){
  typeFilter=t
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active')
  filter()
}
filter()
</script>
</body>
</html>`
}

// ── URL metadata ──────────────────────────────────────────────────────────────

interface UrlMetadata {
  title: string
  description?: string
  favicon?: string
  readingTime: number
  thumbnailPath?: string   // local path to downloaded thumbnail (YouTube etc.)
  channel?: string         // YouTube channel name
}

// ── YouTube helpers ───────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pat of patterns) {
    const m = url.match(pat)
    if (m) return m[1]
  }
  return null
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(destPath)
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlink(destPath, () => {})
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function fetchYouTubeMetadata(videoId: string, rawUrl: string): Promise<UrlMetadata> {
  const favicon = 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32'
  const fallback: UrlMetadata = { title: rawUrl, favicon, readingTime: 1 }

  try {
    // oEmbed — no API key needed, always works
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const data = await new Promise<Record<string, string>>((resolve, reject) => {
      https.get(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = ''
        res.on('data', (c: string) => { body += c })
        res.on('end', () => {
          try { resolve(JSON.parse(body)) } catch { reject(new Error('Bad JSON')) }
        })
      }).on('error', reject)
    })

    // Download the highest quality thumbnail available
    const imagesDir = getImagesDir()
    const thumbPath = path.join(imagesDir, `yt_${videoId}_${Date.now()}.jpg`)
    // Try maxresdefault first, fall back to hqdefault
    const thumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    const hqUrl    = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

    let thumbnailPath: string | undefined
    try {
      await downloadFile(thumbUrl, thumbPath)
      // maxresdefault sometimes returns a 120x90 placeholder — check file size
      const stat = fs.statSync(thumbPath)
      if (stat.size < 5000) {
        // Too small = placeholder, try hq instead
        await downloadFile(hqUrl, thumbPath)
      }
      thumbnailPath = thumbPath
    } catch {
      try { await downloadFile(hqUrl, thumbPath); thumbnailPath = thumbPath } catch { /* ignore */ }
    }

    return {
      title: data.title || rawUrl,
      description: `${data.author_name ? `by ${data.author_name}` : ''} · YouTube`,
      favicon,
      readingTime: 1,
      thumbnailPath,
      channel: data.author_name
    }
  } catch (err) {
    console.error('YouTube metadata fetch failed:', err)
    return fallback
  }
}

// ── Vimeo helpers ─────────────────────────────────────────────────────────────

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? m[1] : null
}

async function fetchVimeoMetadata(videoId: string, rawUrl: string): Promise<UrlMetadata> {
  const favicon = 'https://www.google.com/s2/favicons?domain=vimeo.com&sz=32'
  const fallback: UrlMetadata = { title: rawUrl, favicon, readingTime: 1 }

  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`
    const data = await new Promise<Record<string, string>>((resolve, reject) => {
      https.get(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = ''
        res.on('data', (c: string) => { body += c })
        res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Bad JSON')) } })
      }).on('error', reject)
    })

    let thumbnailPath: string | undefined
    if (data.thumbnail_url) {
      const imagesDir = getImagesDir()
      const thumbPath = path.join(imagesDir, `vimeo_${videoId}_${Date.now()}.jpg`)
      try { await downloadFile(data.thumbnail_url, thumbPath); thumbnailPath = thumbPath } catch { /* skip */ }
    }

    return {
      title: data.title || rawUrl,
      description: `${data.author_name ? `by ${data.author_name}` : ''} · Vimeo`,
      favicon,
      readingTime: 1,
      thumbnailPath,
      channel: data.author_name
    }
  } catch {
    return fallback
  }
}

// ── Dead link check ───────────────────────────────────────────────────────────

function checkLinkAlive(rawUrl: string): Promise<'ok' | 'dead' | 'unknown'> {
  return new Promise((resolve) => {
    let parsed: URL
    try { parsed = new URL(rawUrl) } catch { resolve('unknown'); return }
    const protocol = parsed.protocol === 'https:' ? https : http
    const options = {
      method: 'HEAD',
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : undefined,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HoardBot/1.0)' }
    }
    const req = protocol.request(options, (res) => {
      const code = res.statusCode ?? 0
      res.resume()
      resolve(code >= 200 && code < 400 ? 'ok' : code >= 400 ? 'dead' : 'unknown')
    })
    req.on('error', () => resolve('unknown'))
    req.setTimeout(8000, () => { req.destroy(); resolve('unknown') })
    req.end()
  })
}

// ── Reddit fast-path ──────────────────────────────────────────────────────────

function isRedditUrl(url: string): boolean {
  return /reddit\.com\/r\/[^/]+\/comments\//.test(url)
}

async function fetchRedditMetadata(rawUrl: string): Promise<UrlMetadata> {
  const jsonUrl = rawUrl.replace(/\/$/, '') + '.json?limit=1'
  const favicon = 'https://www.google.com/s2/favicons?domain=reddit.com&sz=32'
  const fallback: UrlMetadata = { title: rawUrl, favicon, readingTime: 1 }
  return new Promise((resolve) => {
    const req = https.get(jsonUrl, { headers: { 'User-Agent': 'HoardBot/1.0' } }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => { data += c; if (data.length > 200_000) req.destroy() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const post = json[0]?.data?.children?.[0]?.data
          if (!post) { resolve(fallback); return }
          const score = post.score ? ` · ${post.score >= 1000 ? (post.score / 1000).toFixed(1) + 'k' : post.score} pts` : ''
          resolve({
            title: post.title || fallback.title,
            description: `r/${post.subreddit}${score} · ${post.num_comments ?? 0} comments`,
            favicon,
            readingTime: 1
          })
        } catch { resolve(fallback) }
      })
    })
    req.on('error', () => resolve(fallback))
    req.setTimeout(8000, () => { req.destroy(); resolve(fallback) })
  })
}

// ── GitHub fast-path ──────────────────────────────────────────────────────────

function extractGitHubRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

async function fetchGitHubMetadata(owner: string, repo: string, rawUrl: string): Promise<UrlMetadata> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
  const favicon = 'https://www.google.com/s2/favicons?domain=github.com&sz=32'
  const fallback: UrlMetadata = { title: `${owner}/${repo}`, favicon, readingTime: 1 }
  return new Promise((resolve) => {
    const req = https.get(apiUrl, { headers: { 'User-Agent': 'HoardBot/1.0', 'Accept': 'application/vnd.github.v3+json' } }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => { data += c })
      res.on('end', () => {
        try {
          const r = JSON.parse(data)
          if (r.message) { resolve(fallback); return }
          const stars = r.stargazers_count >= 1000
            ? (r.stargazers_count / 1000).toFixed(1) + 'k ⭐'
            : `${r.stargazers_count} ⭐`
          const lang = r.language ? ` · ${r.language}` : ''
          resolve({
            title: r.full_name || fallback.title,
            description: r.description ? `${r.description} · ${stars}${lang}` : `${stars}${lang}`,
            favicon,
            readingTime: 1
          })
        } catch { resolve(fallback) }
      })
    })
    req.on('error', () => resolve(fallback))
    req.setTimeout(8000, () => { req.destroy(); resolve(fallback) })
  })
}

export function fetchUrlMetadata(rawUrl: string): Promise<UrlMetadata> {
  // ── YouTube fast-path ─────────────────────────────────────────────────────
  const ytId = extractYouTubeId(rawUrl)
  if (ytId) return fetchYouTubeMetadata(ytId, rawUrl)

  // ── Vimeo fast-path ───────────────────────────────────────────────────────
  const vimeoId = extractVimeoId(rawUrl)
  if (vimeoId) return fetchVimeoMetadata(vimeoId, rawUrl)

  // ── Reddit fast-path ──────────────────────────────────────────────────────
  if (isRedditUrl(rawUrl)) return fetchRedditMetadata(rawUrl)

  // ── GitHub fast-path ──────────────────────────────────────────────────────
  const ghRepo = extractGitHubRepo(rawUrl)
  if (ghRepo && /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(rawUrl)) {
    return fetchGitHubMetadata(ghRepo.owner, ghRepo.repo, rawUrl)
  }

  // ── Generic HTML scrape ───────────────────────────────────────────────────
  return new Promise((resolve) => {
    let parsed: URL
    try { parsed = new URL(rawUrl) }
    catch { resolve({ title: rawUrl, readingTime: 1 }); return }

    const favicon  = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`
    const fallback: UrlMetadata = { title: parsed.hostname, favicon, readingTime: 1 }

    // Use a realistic browser User-Agent to avoid bot blocks
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const protocol = parsed.protocol === 'https:' ? https : http

    const req = protocol.get(rawUrl, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try {
          fetchUrlMetadata(new URL(res.headers.location, rawUrl).toString()).then(resolve)
        } catch { resolve(fallback) }
        return
      }

      // Skip non-HTML responses
      const ct = res.headers['content-type'] || ''
      if (!ct.includes('text/html')) { resolve(fallback); return }

      let html = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => { html += chunk; if (html.length > 200_000) req.destroy() })
      res.on('end', async () => {
        const ogTitle  = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i)?.[1]
                      || html.match(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+property=["']og:title["']/i)?.[1]
        const title    = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim()
        const ogDesc   = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i)?.[1]
                      || html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+property=["']og:description["']/i)?.[1]
        const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i)?.[1]
        const ogImage  = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,600})["']/i)?.[1]
                      || html.match(/<meta[^>]+content=["']([^"']{1,600})["'][^>]+property=["']og:image["']/i)?.[1]
        const words    = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').split(' ').filter((w) => w.length > 2).length

        // ── Download og:image as local thumbnail ─────────────────────────────
        let thumbnailPath: string | undefined
        if (ogImage) {
          try {
            const imgUrl  = new URL(ogImage, rawUrl).toString()
            const imgExt  = path.extname(new URL(imgUrl).pathname).slice(0, 5) || '.jpg'
            const imgPath = path.join(getImagesDir(), `og_${Date.now()}${imgExt}`)
            await downloadFile(imgUrl, imgPath)
            const stat = fs.statSync(imgPath)
            if (stat.size > 2000) {  // ignore tiny/placeholder images
              thumbnailPath = imgPath
            } else {
              fs.unlink(imgPath, () => {})
            }
          } catch { /* og:image download failed — skip */ }
        }

        resolve({
          title: ogTitle || title || parsed.hostname,
          description: ogDesc || metaDesc,
          favicon,
          readingTime: Math.max(1, Math.ceil(words / 200)),
          thumbnailPath
        })
      })
    })

    req.on('error', () => resolve(fallback))
    req.setTimeout(10000, () => { req.destroy(); resolve(fallback) })
  })
}
