import { BrowserWindow, globalShortcut, app } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let captureWindow: BrowserWindow | null = null

export function createCaptureWindow(): void {
  // Create hidden; shown on hotkey
  captureWindow = new BrowserWindow({
    width: 420,
    height: 320,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: '#141414',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  captureWindow.on('blur', () => {
    captureWindow?.hide()
  })

  captureWindow.on('closed', () => {
    captureWindow = null
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    captureWindow.loadURL(rendererUrl + '#capture')
  } else {
    captureWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'capture' })
  }
}

export function registerCaptureShortcut(): void {
  // Ctrl+Shift+Space (Windows/Linux), same on macOS
  const shortcut = 'CommandOrControl+Shift+Space'

  const registered = globalShortcut.register(shortcut, () => {
    if (!captureWindow) {
      createCaptureWindow()
      // Wait for window to load before showing
      captureWindow!.once('ready-to-show', () => {
        showCapture()
      })
      return
    }
    if (captureWindow.isVisible()) {
      captureWindow.hide()
    } else {
      showCapture()
    }
  })

  if (!registered) {
    console.warn('[capture] Failed to register global shortcut', shortcut)
  }
}

function showCapture(): void {
  if (!captureWindow) return
  // Center on screen
  const { screen } = require('electron')
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const winW = 420, winH = 320
  captureWindow.setPosition(
    Math.round((width - winW) / 2),
    Math.round((height - winH) / 3)
  )
  captureWindow.show()
  captureWindow.focus()
}

export function unregisterCaptureShortcut(): void {
  globalShortcut.unregister('CommandOrControl+Shift+Space')
}
