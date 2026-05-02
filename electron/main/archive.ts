import { BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { itemQueries } from './db'
import { sendToRenderer } from './window'

export async function archiveWebPage(itemId: number, url: string): Promise<void> {
  // Mark as pending immediately so the UI can show a spinner
  itemQueries.update(itemId, { archiveStatus: 'pending' })
  sendToRenderer('item:archive-status', { id: itemId, status: 'pending' })

  return new Promise<void>((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const cleanup = (status: 'done' | 'failed', archivePath?: string) => {
      if (!win.isDestroyed()) win.destroy()
      itemQueries.update(itemId, {
        archiveStatus: status,
        ...(archivePath ? { archivePath } : {})
      })
      sendToRenderer('item:archive-status', { id: itemId, status, archivePath })
      resolve()
    }

    win.webContents.on('did-finish-load', async () => {
      try {
        const archivesDir = path.join(app.getPath('userData'), 'archives')
        if (!fs.existsSync(archivesDir)) fs.mkdirSync(archivesDir, { recursive: true })

        const mhtmlPath = path.join(archivesDir, `${itemId}_${Date.now()}.mhtml`)
        await win.webContents.savePage(mhtmlPath, 'MHTML')
        cleanup('done', mhtmlPath)
      } catch {
        cleanup('failed')
      }
    })

    win.webContents.on('did-fail-load', () => cleanup('failed'))

    const timeout = setTimeout(() => cleanup('failed'), 30_000)
    win.webContents.once('did-finish-load', () => clearTimeout(timeout))

    win.loadURL(url)
  })
}
