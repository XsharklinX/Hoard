import { BrowserWindow } from 'electron'

let _mainWindow: BrowserWindow | null = null

export function setMainWindow(w: BrowserWindow | null): void {
  _mainWindow = w
}

export function getMainWindow(): BrowserWindow | null {
  return _mainWindow
}

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  _mainWindow?.webContents.send(channel, ...args)
}
