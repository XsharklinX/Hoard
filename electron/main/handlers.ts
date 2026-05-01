import { ipcMain, shell, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import { vaultQueries, folderQueries, itemQueries, tagQueries, getImagesDir, CreateItemData } from './db'
import { loadSettings, saveSettings } from './settings'

export function registerHandlers(): void {
  // ── Vaults ──────────────────────────────────────────────────────────────────
  ipcMain.handle('vault:list',   ()                                        => vaultQueries.list())
  ipcMain.handle('vault:create', (_e, name: string, color: string)         => vaultQueries.create(name, color))
  ipcMain.handle('vault:update', (_e, id: number, name: string, color: string) => vaultQueries.update(id, name, color))
  ipcMain.handle('vault:delete', (_e, id: number)                          => { vaultQueries.delete(id) })

  // ── Folders ─────────────────────────────────────────────────────────────────
  ipcMain.handle('folder:list',   (_e, vaultId: number)                              => folderQueries.list(vaultId))
  ipcMain.handle('folder:create', (_e, vaultId: number, name: string, parentId?: number, smartQuery?: string) => folderQueries.create(vaultId, name, parentId, smartQuery))
  ipcMain.handle('folder:update', (_e, id: number, name: string, smartQuery?: string) => folderQueries.update(id, name, smartQuery))
  ipcMain.handle('folder:delete', (_e, id: number)                                   => { folderQueries.delete(id) })

  // ── Items ────────────────────────────────────────────────────────────────────
  ipcMain.handle('item:counts', (_e, vaultId: number) => itemQueries.counts(vaultId))
  ipcMain.handle('item:list',   (_e, params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: string | null }) => itemQueries.list(params))
  ipcMain.handle('item:create', (_e, data: CreateItemData) => {
    const item = itemQueries.create(data)
    if (data.type === 'image' && data.imagePath) {
      const { processImageOcr } = require('./ocr')
      processImageOcr(item.id, data.imagePath)
    } else if (data.type === 'link' && data.url) {
      // Archive runs in background — no await
      const { archiveWebPage } = require('./archive')
      archiveWebPage(item.id, data.url).catch(console.error)
    }
    return item
  })
  ipcMain.handle('item:update', (_e, id: number, data: Partial<CreateItemData>)  => itemQueries.update(id, data))
  ipcMain.handle('item:pin',    (_e, id: number, pinned: boolean)                => { itemQueries.pin(id, pinned) })
  ipcMain.handle('item:delete', (_e, id: number)                                 => { itemQueries.delete(id) })

  // ── Tags ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('tag:list',         (_e, vaultId: number)                           => tagQueries.list(vaultId))
  ipcMain.handle('tag:create',       (_e, vaultId: number, name: string, color: string) => tagQueries.create(vaultId, name, color))
  ipcMain.handle('tag:delete',       (_e, id: number)                                => { tagQueries.delete(id) })
  ipcMain.handle('tag:set-item',     (_e, itemId: number, tagIds: number[])          => { tagQueries.setItemTags(itemId, tagIds) })

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:load', ()                              => loadSettings())
  ipcMain.handle('settings:save', (_e, patch: object)            => saveSettings(patch as Parameters<typeof saveSettings>[0]))
  ipcMain.handle('settings:get-data-path',     ()  => app.getPath('userData'))
  ipcMain.handle('settings:open-data-folder',  ()  => { shell.openPath(app.getPath('userData')) })

  // ── Utilities ────────────────────────────────────────────────────────────────
  ipcMain.handle('util:fetch-metadata', async (_e, url: string) => fetchUrlMetadata(url))

  ipcMain.handle('util:save-image', async (_e, srcPath: string) => {
    const imagesDir = getImagesDir()
    const destPath = path.join(imagesDir, `${Date.now()}.jpg`) // Force jpg for compression

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Jimp = require('jimp')
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

  // ── Bookmarks import ────────────────────────────────────────────────────────
  ipcMain.handle('bookmarks:import', async (_e, vaultId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Select bookmarks file',
      filters: [{ name: 'HTML Bookmarks', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { count: 0, cancelled: true }

    const html = fs.readFileSync(result.filePaths[0], 'utf-8')
    const bookmarks = parseNetscapeBookmarks(html)

    // Bulk insert without enrichment first — fast
    for (const bm of bookmarks) {
      itemQueries.create({ vaultId, type: 'link', url: bm.url, title: bm.title })
    }

    // Throttled background enrichment: 5 concurrent requests max
    const enrichQueue = [...bookmarks.map((_, i) => i)]
    const enriched = itemQueries.list({ vaultId }).slice(-bookmarks.length).reverse()

    async function runPool(concurrency: number) {
      const worker = async () => {
        while (enrichQueue.length) {
          const idx = enrichQueue.shift()!
          const item = enriched[idx]
          if (!item?.url) continue
          try {
            const meta = await fetchUrlMetadata(item.url as string)
            itemQueries.update(item.id as number, {
              title: (meta.title !== item.url ? meta.title : undefined) || item.title as string,
              content: meta.description,
              favicon: meta.favicon,
              readingTime: meta.readingTime,
              imagePath: meta.thumbnailPath
            })
          } catch { /* skip silently */ }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker))
    }

    // Fire and forget — don't block the IPC response
    runPool(5).catch(console.error)

    return { count: bookmarks.length }
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

export function fetchUrlMetadata(rawUrl: string): Promise<UrlMetadata> {
  // ── YouTube fast-path ─────────────────────────────────────────────────────
  const ytId = extractYouTubeId(rawUrl)
  if (ytId) return fetchYouTubeMetadata(ytId, rawUrl)

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
