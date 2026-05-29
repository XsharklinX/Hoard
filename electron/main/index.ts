import { app, BrowserWindow, nativeTheme, protocol, net, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'fs'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { initDb, saveDb, itemQueries } from './db'
import { registerHandlers, setNeedsPassword } from './handlers'
import { startLocalServer } from './server'
import { setMainWindow, sendToRenderer } from './window'
import { shutdownOcrWorker } from './ocr'
import { loadSettings, saveSettings } from './settings'
import { exportBackup } from './backup'
import { createCaptureWindow, registerCaptureShortcut, unregisterCaptureShortcut } from './capture'
import { startSyncWatcher, stopSyncWatcher } from './syncFolder'
import { startFeedPoller, stopFeedPoller } from './handlers'
import icon from '../../resources/icon.png?asset'

protocol.registerSchemesAsPrivileged([
  { scheme: 'hoard', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } }
])

nativeTheme.themeSource = 'dark'

// Prevent a second instance from starting — show the existing window instead
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

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
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  setMainWindow(mainWindow)
  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // ── Close / minimize-to-tray behaviour ───────────────────────────────────────
  mainWindow.on('close', (e) => {
    const { minimizeToTray } = loadSettings()
    if (minimizeToTray ?? true) {
      e.preventDefault()
      mainWindow?.hide()
      if (process.platform === 'win32') {
        tray?.displayBalloon({
          title: 'Hoard is still running',
          content: 'The extension keeps working in the background. Double-click the tray icon to reopen.'
        })
      }
    } else {
      tray?.destroy()
      app.exit(0)
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

// ── Startup setting sync ──────────────────────────────────────────────────────
function syncStartupSetting(): void {
  if (!app.isPackaged) return
  const { launchAtStartup } = loadSettings()
  app.setLoginItemSettings({ openAtLogin: launchAtStartup })
}

// ── Auto-backup ───────────────────────────────────────────────────────────────
function runAutoBackupIfNeeded(): void {
  const settings = loadSettings()
  if (!settings.autoBackupEnabled || !settings.autoBackupPath) return
  if (!fs.existsSync(settings.autoBackupPath)) return

  const intervalMs = (settings.autoBackupIntervalDays || 7) * 24 * 60 * 60 * 1000
  if (Date.now() - (settings.autoBackupLastRun || 0) < intervalMs) return

  const date    = new Date().toISOString().slice(0, 10)
  const destPath = `${settings.autoBackupPath}/hoard-auto-${date}.hoard`
  try {
    exportBackup(destPath)
    saveSettings({ autoBackupLastRun: Date.now() })
    console.log('[auto-backup] saved to', destPath)
  } catch (err) {
    console.error('[auto-backup] failed:', err)
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

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('updater:up-to-date', {})
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
    sendToRenderer('updater:error', { message: err.message })
  })

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000)
}

// ── Scheduled tasks ───────────────────────────────────────────────────────────
function runScheduledTasks(): void {
  const settings = loadSettings()
  if (settings.autoArchiveEnabled && settings.autoArchiveAfterDays > 0) {
    const n = itemQueries.archiveOldUnread(settings.autoArchiveAfterDays)
    if (n > 0) { console.log(`[scheduled] Auto-archived ${n} old unread items`); sendToRenderer('item:refresh', {}) }
  }
  if (settings.autopurgeDeadLinksEnabled && settings.autopurgeDeadLinksAfterDays > 0) {
    const n = itemQueries.purgeDeadLinks(settings.autopurgeDeadLinksAfterDays)
    if (n > 0) { console.log(`[scheduled] Purged ${n} dead links`); sendToRenderer('item:refresh', {}) }
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

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
  createCaptureWindow()
  registerCaptureShortcut()
  setupAutoUpdater()
  syncStartupSetting()
  runAutoBackupIfNeeded()
  // Re-check auto-backup every 12 hours while the app is running
  setInterval(runAutoBackupIfNeeded, 12 * 60 * 60 * 1000)

  // Sync folder watcher
  const { syncFolderEnabled, syncFolderPath } = loadSettings()
  if (syncFolderEnabled && syncFolderPath) startSyncWatcher(syncFolderPath)

  // Scheduled tasks (run once at startup, then every 24h)
  runScheduledTasks()
  setInterval(runScheduledTasks, 24 * 60 * 60 * 1000)

  // Feed poller
  startFeedPoller()

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
  unregisterCaptureShortcut()
  stopSyncWatcher()
  stopFeedPoller()
  try { saveDb() } catch { /* ignore */ }
  shutdownOcrWorker().catch(() => {})
})

// Never quit when all windows close — we live in the tray
app.on('window-all-closed', () => {
  // Do nothing — the tray keeps the process alive
})
