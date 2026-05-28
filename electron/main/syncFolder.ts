import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { itemQueries, vaultQueries } from './db'
import { fetchUrlMetadata } from './handlers'
import { sendToRenderer } from './window'

let watcher: fs.FSWatcher | null = null

function cachePath(): string {
  return path.join(app.getPath('userData'), 'sync-imported.json')
}

let imported: Set<string> = new Set()
function loadCache() {
  try { imported = new Set(JSON.parse(fs.readFileSync(cachePath(), 'utf-8'))) } catch { imported = new Set() }
}
function saveCache() {
  try { fs.writeFileSync(cachePath(), JSON.stringify([...imported]), 'utf-8') } catch { /* ignore */ }
}

function parseUrlFile(content: string): string | null {
  const m = content.match(/^URL=(.+)$/im)
  return m ? m[1].trim() : null
}
function parseWeblocFile(content: string): string | null {
  const m = content.match(/<string>(https?:\/\/[^<]+)<\/string>/)
  return m ? m[1].trim() : null
}
function parseTextUrls(content: string): string[] {
  return content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && /^https?:\/\//.test(l))
}

function getDefaultVaultId(): number {
  const vaults = vaultQueries.list() as Array<{ id: number }>
  return vaults[0]?.id ?? 1
}

async function importUrl(url: string, vaultId: number): Promise<void> {
  try {
    const meta = await fetchUrlMetadata(url)
    itemQueries.create({ vaultId, type: 'link', url, title: meta.title, content: meta.description, favicon: meta.favicon, readingTime: meta.readingTime, imagePath: meta.thumbnailPath })
    sendToRenderer('item:refresh', {})
  } catch (err) {
    console.error('[sync] Failed to import', url, err)
  }
}

async function processFile(filePath: string, vaultId: number): Promise<void> {
  const key = path.resolve(filePath)
  if (imported.has(key)) return
  const ext = path.extname(filePath).toLowerCase()
  if (!['.url', '.txt', '.webloc'].includes(ext)) return
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const urls: string[] = []
    if (ext === '.url') { const u = parseUrlFile(content); if (u) urls.push(u) }
    else if (ext === '.webloc') { const u = parseWeblocFile(content); if (u) urls.push(u) }
    else urls.push(...parseTextUrls(content))
    for (const url of urls) await importUrl(url, vaultId)
    if (urls.length) { imported.add(key); saveCache() }
  } catch (err) { console.error('[sync] Error processing', filePath, err) }
}

export function startSyncWatcher(folderPath: string): void {
  stopSyncWatcher()
  if (!folderPath || !fs.existsSync(folderPath)) return
  loadCache()
  const vaultId = getDefaultVaultId()
  // Scan existing files
  try {
    for (const f of fs.readdirSync(folderPath)) {
      const ext = path.extname(f).toLowerCase()
      if (['.url', '.txt', '.webloc'].includes(ext)) {
        processFile(path.join(folderPath, f), vaultId).catch(console.error)
      }
    }
  } catch { /* ignore */ }
  // Watch for new files
  watcher = fs.watch(folderPath, (_evt, filename) => {
    if (!filename) return
    const fp = path.join(folderPath, filename)
    setTimeout(() => { if (fs.existsSync(fp)) processFile(fp, vaultId).catch(console.error) }, 500)
  })
  watcher.on('error', (err) => console.error('[sync] Watcher error:', err))
  console.log('[sync] Watching', folderPath)
}

export function stopSyncWatcher(): void {
  if (watcher) { watcher.close(); watcher = null; console.log('[sync] Stopped') }
}
