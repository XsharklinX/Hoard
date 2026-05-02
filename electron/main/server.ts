import http from 'http'
import { itemQueries, vaultQueries, folderQueries, tagQueries } from './db'
import { BrowserWindow } from 'electron'
import { fetchUrlMetadata } from './handlers'

const PORT = 43210

export function startLocalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

    // ── GET /status — popup uses this to check if Hoard is running ────────────
    if (req.method === 'GET' && req.url === '/status') {
      const vaults = vaultQueries.list()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, vaults }))
      return
    }

    // Parse URL once for all GET routes
    const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
    const pathname  = parsedUrl.pathname

    // ── GET /recent — popup fetches recently saved items ──────────────────────
    if (req.method === 'GET' && pathname === '/recent') {
      const allVaults = vaultQueries.list() as Array<{ id: number }>
      const qVaultId  = parseInt(parsedUrl.searchParams.get('vaultId') || '0')
      const vaultId   = (qVaultId && allVaults.find((v) => v.id === qVaultId)) ? qVaultId : allVaults[0]?.id ?? 1
      const limit     = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '20'), 50)
      const items     = itemQueries.list({ vaultId }).slice(0, limit)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ items }))
      return
    }

    // ── GET /data — popup fetches folders + tags for a vault ─────────────────
    if (req.method === 'GET' && pathname === '/data') {
      const allVaults = vaultQueries.list() as Array<{ id: number }>
      const qVaultId  = parseInt(parsedUrl.searchParams.get('vaultId') || '0')
      const vaultId   = (qVaultId && allVaults.find((v) => v.id === qVaultId)) ? qVaultId : allVaults[0]?.id ?? 1
      const folders   = folderQueries.list(vaultId)
      const tags      = tagQueries.list(vaultId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ folders, tags }))
      return
    }

    // ── GET /check — check if a URL already exists in a vault ────────────────
    if (req.method === 'GET' && pathname === '/check') {
      const url       = parsedUrl.searchParams.get('url') || ''
      const allVaults = vaultQueries.list() as Array<{ id: number }>
      const qVaultId  = parseInt(parsedUrl.searchParams.get('vaultId') || '0')
      const vaultId   = (qVaultId && allVaults.find((v) => v.id === qVaultId)) ? qVaultId : allVaults[0]?.id ?? 1
      const items     = itemQueries.list({ vaultId }) as Array<{ url: string | null }>
      const norm      = (u: string) => u.toLowerCase().replace(/\/$/, '')
      const exists    = url ? items.some((i) => i.url && norm(i.url) === norm(url)) : false
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ exists }))
      return
    }

    // ── GET /search — omnibox live suggestions ────────────────────────────────
    if (req.method === 'GET' && pathname === '/search') {
      const q         = (parsedUrl.searchParams.get('q') || '').toLowerCase()
      const allVaults = vaultQueries.list() as Array<{ id: number }>
      const qVaultId  = parseInt(parsedUrl.searchParams.get('vaultId') || '0')
      const vaultId   = (qVaultId && allVaults.find((v) => v.id === qVaultId)) ? qVaultId : allVaults[0]?.id ?? 1
      const limit     = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '6'), 20)
      const all       = itemQueries.list({ vaultId }) as Array<{ id: number; title: string | null; url: string | null; type: string }>
      const hits      = q
        ? all.filter((i) => (i.title || '').toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q)).slice(0, limit)
        : all.slice(0, limit)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ items: hits }))
      return
    }

    // ── POST /add-batch — bulk-save images from extension board import ───────
    if (req.method === 'POST' && pathname === '/add-batch') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const payload   = JSON.parse(body)
          const allVaults = vaultQueries.list() as Array<{ id: number }>
          const vaultId   = (payload.vaultId && allVaults.find((v) => v.id === payload.vaultId))
            ? payload.vaultId : allVaults[0]?.id ?? 1
          const tagIds    = Array.isArray(payload.tagIds) ? payload.tagIds : []

          // Auto-create folder if folderName provided
          let folderId: number | null = payload.folderId ?? null
          let resolvedFolderName: string | null = null
          if (!folderId && payload.folderName) {
            const reqName = String(payload.folderName).trim().slice(0, 80)
            if (reqName) {
              const existing = (folderQueries.list(vaultId) as Array<{ id: number; name: string }>)
                .find((f) => f.name.toLowerCase() === reqName.toLowerCase())
              if (existing) {
                folderId = existing.id
                resolvedFolderName = existing.name
              } else {
                const newFolder = folderQueries.create(vaultId, reqName) as { id: number; name: string }
                folderId = newFolder.id
                resolvedFolderName = newFolder.name
                notifyRenderer()
              }
            }
          }

          const rawItems  = Array.isArray(payload.items) ? payload.items : [] as Array<{ url: string; title?: string }>
          const created: Array<{ id: number; url: string }> = []

          // Insert all items immediately with URL only — never block on downloads
          for (const img of rawItems) {
            if (!img.url || !img.url.startsWith('http')) continue
            let hostname = img.url
            try { hostname = new URL(img.url).hostname } catch { /* ok */ }
            const item = itemQueries.create({
              vaultId,
              type:     'image',
              url:      img.url,
              title:    (img.title || hostname).slice(0, 200),
              folderId: folderId || undefined,
              tagIds:   tagIds.length ? tagIds : undefined,
            })
            created.push({ id: (item as { id: number }).id, url: img.url })
          }

          notifyRenderer()

          // Background download with concurrency = 5
          const queue = [...created]
          async function downloadWorker() {
            while (queue.length) {
              const entry = queue.shift()!
              try {
                const localPath = await downloadImage(entry.url)
                itemQueries.update(entry.id, { imagePath: localPath })
              } catch { /* keep URL-only if download fails */ }
            }
          }
          Promise.all(Array.from({ length: 5 }, downloadWorker))
            .then(() => notifyRenderer())
            .catch(console.error)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            count: created.length,
            folderId,
            folderName: folderId
              ? (folderQueries.list(vaultId) as Array<{ id: number; name: string }>).find(f => f.id === folderId)?.name || null
              : null
          }))
        } catch (err) {
          res.writeHead(500); res.end(JSON.stringify({ error: String(err) }))
        }
      })
      return
    }

    // ── POST /bookmarks-import — import Netscape HTML bookmarks file ──────────
    if (req.method === 'POST' && pathname === '/bookmarks-import') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const { html, vaultId: rawVaultId } = JSON.parse(body)
          const allVaults = vaultQueries.list() as Array<{ id: number }>
          const vaultId   = (rawVaultId && allVaults.find((v) => v.id === rawVaultId))
            ? rawVaultId : allVaults[0]?.id ?? 1

          const bookmarks = parseNetscapeBookmarks(html as string)
          for (const bm of bookmarks) {
            itemQueries.create({ vaultId, type: 'link', url: bm.url, title: bm.title })
          }
          notifyRenderer()

          // Throttled background enrichment
          const inserted = (itemQueries.list({ vaultId }) as Array<{ id: number; url: string | null; title: string | null }>)
            .slice(-bookmarks.length).reverse()
          const queue = inserted.map((_, i) => i)
          async function runPool(n: number) {
            const worker = async () => {
              while (queue.length) {
                const i = queue.shift()!
                const item = inserted[i]
                if (!item?.url) continue
                try {
                  const meta = await fetchUrlMetadata(item.url)
                  itemQueries.update(item.id, {
                    title: meta.title || item.title || undefined,
                    content: meta.description, favicon: meta.favicon,
                    readingTime: meta.readingTime, imagePath: meta.thumbnailPath
                  })
                } catch { /* skip */ }
              }
            }
            await Promise.all(Array.from({ length: n }, worker))
            notifyRenderer()
          }
          runPool(5).catch(console.error)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ count: bookmarks.length }))
        } catch (err) {
          res.writeHead(500); res.end(JSON.stringify({ error: String(err) }))
        }
      })
      return
    }

    // ── POST /add — save a new item from the extension ────────────────────────
    if (req.method === 'POST' && pathname === '/add') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })

      req.on('end', async () => {
        try {
          const payload = JSON.parse(body)
          const allVaults = vaultQueries.list() as Array<{ id: number }>
          const vaultId   = (payload.vaultId && allVaults.find((v: { id: number }) => v.id === payload.vaultId))
            ? payload.vaultId
            : allVaults[0]?.id ?? 1
          const folderId  = payload.folderId ?? null
          const tagIds    = Array.isArray(payload.tagIds) ? payload.tagIds : []

          if (payload.type === 'link' && payload.url) {
            // ── Save immediately with what we have, never block on metadata ──
            const item = itemQueries.create({
              vaultId,
              type:     'link',
              url:      payload.url,
              title:    payload.title || new URL(payload.url).hostname,
              folderId: folderId || undefined,
              tagIds:   tagIds.length ? tagIds : undefined,
            })

            // ── Notify renderer right away so the card appears instantly ─────
            notifyRenderer()

            // ── Enrich in background (metadata + thumbnail) ──────────────────
            enrichLinkInBackground(item.id, payload.url).catch(console.error)

          } else if (payload.type === 'image' && payload.srcUrl) {
            let localPath = ''
            try {
              if (payload.srcUrl.startsWith('http')) {
                localPath = await downloadImage(payload.srcUrl)
              } else if (payload.srcUrl.startsWith('data:image')) {
                localPath = saveBase64Image(payload.srcUrl)
              }
            } catch (imgErr) {
              console.error('Image download failed, saving URL only:', imgErr)
            }

            itemQueries.create({
              vaultId,
              type:     'image',
              imagePath: localPath || undefined,
              url:      payload.srcUrl,
              folderId: folderId || undefined,
              tagIds:   tagIds.length ? tagIds : undefined,
            })

            notifyRenderer()
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))

        } catch (error) {
          console.error('Hoard server /add error:', error)
          res.writeHead(500)
          res.end(JSON.stringify({ error: String(error) }))
        }
      })
    } else {
      res.writeHead(404); res.end()
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Hoard local server listening on port ${PORT}`)
  })
}

function notifyRenderer() {
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send('item:refresh'))
}

/** Fetch metadata + thumbnail in background and update the item */
async function enrichLinkInBackground(itemId: number, url: string) {
  try {
    const meta = await fetchUrlMetadata(url)
    itemQueries.update(itemId, {
      title:       meta.title || undefined,
      content:     meta.description || undefined,
      favicon:     meta.favicon || undefined,
      readingTime: meta.readingTime,
      imagePath:   meta.thumbnailPath || undefined
    })
    // Archive page (non-critical)
    const { archiveWebPage } = require('./archive')
    archiveWebPage(itemId, url).catch(console.error)
    // Notify again so the UI refreshes with the enriched data
    notifyRenderer()
  } catch (err) {
    console.error(`Background enrichment failed for item ${itemId}:`, err)
  }
}


import https from 'https'
import fs from 'fs'
import path from 'path'
import { getImagesDir } from './db'

function downloadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const imagesDir = getImagesDir()
    const ext = path.extname(new URL(url).pathname) || '.jpg'
    const destPath = path.join(imagesDir, `${Date.now()}${ext}`)
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hoard/1.0)' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject)
      }
      const fileStream = fs.createWriteStream(destPath)
      res.pipe(fileStream)
      fileStream.on('finish', () => { fileStream.close(); resolve(destPath) })
      fileStream.on('error', reject)
    }).on('error', reject)
  })
}

function saveBase64Image(dataUrl: string): string {
  const matches = dataUrl.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) throw new Error('Invalid base64 string')
  
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
  const imagesDir = getImagesDir()
  const destPath = path.join(imagesDir, `${Date.now()}.${ext}`)
  
  fs.writeFileSync(destPath, Buffer.from(matches[2], 'base64'))
  return destPath
}

function parseNetscapeBookmarks(html: string): { url: string; title: string }[] {
  const results: { url: string; title: string }[] = []
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const url   = m[1].trim()
    const title = m[2].trim()
    if (!url || url.startsWith('javascript:') || url.startsWith('place:') || url.startsWith('about:')) continue
    results.push({ url, title: title || url })
  }
  return results
}
