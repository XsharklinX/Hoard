import http from 'http'
import { itemQueries, vaultQueries } from './db'
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

    // ── GET /recent — popup fetches last 5 saved items ────────────────────────
    if (req.method === 'GET' && req.url === '/recent') {
      const vaults = vaultQueries.list()
      const vaultId = vaults[0]?.id ?? 1
      const items = itemQueries.list({ vaultId }).slice(0, 8)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ items }))
      return
    }

    // ── POST /add — save a new item from the extension ────────────────────────
    if (req.method === 'POST' && req.url === '/add') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })

      req.on('end', async () => {
        try {
          const payload = JSON.parse(body)
          const vaults  = vaultQueries.list()
          const vaultId = vaults[0]?.id ?? 1

          if (payload.type === 'link' && payload.url) {
            // ── Save immediately with what we have, never block on metadata ──
            const item = itemQueries.create({
              vaultId,
              type:  'link',
              url:   payload.url,
              title: payload.title || new URL(payload.url).hostname,
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
              type: 'image',
              imagePath: localPath || undefined,
              url: payload.srcUrl
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
