import { app, BrowserWindow, nativeTheme, protocol, net, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { initDb, saveDb } from './db'
import { registerHandlers, setNeedsPassword } from './handlers'
import { startLocalServer } from './server'
import { setMainWindow, sendToRenderer } from './window'
import { shutdownOcrWorker } from './ocr'
import icon from '../../resources/icon.png?asset'

protocol.registerSchemesAsPrivileged([
  { scheme: 'hoard', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } }
])

nativeTheme.themeSource = 'dark'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Hoard — running in background')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Hoard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Hoard',
      click: () => {
        tray?.destroy()
        app.exit(0)
      }
    }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: icon,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  setMainWindow(mainWindow)
  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // ── Minimize to tray instead of closing ──────────────────────────────────────
  mainWindow.on('close', (e) => {
    e.preventDefault()           // Don't actually close
    mainWindow?.hide()           // Just hide the window
    // Show a one-time balloon hint on Windows
    if (process.platform === 'win32') {
      tray?.displayBalloon({
        title: 'Hoard is still running',
        content: 'The extension keeps working in the background. Double-click the tray icon to reopen.'
      })
    }
  })

  mainWindow.on('closed', () => { mainWindow = null; setMainWindow(null) })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  if (!app.isPackaged) return   // only active in production builds

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('updater:available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000)
}

app.whenReady().then(async () => {
  protocol.handle('hoard', (request) => {
    let filePath = request.url.slice('hoard://'.length)
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1)
    }
    filePath = decodeURIComponent(filePath)
    return net.fetch('file:///' + filePath)
  })

  const { needsPassword } = await initDb()
  setNeedsPassword(needsPassword)
  registerHandlers()
  startLocalServer()
  createTray()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
    } else {
      createWindow()
    }
  })
})

// Save DB before quitting (handles force-quit / system shutdown)
app.on('before-quit', () => {
  try { saveDb() } catch { /* ignore */ }
  shutdownOcrWorker().catch(() => {})
})

// Never quit when all windows close — we live in the tray
app.on('window-all-closed', () => {
  // Do nothing — the tray keeps the process alive
})
