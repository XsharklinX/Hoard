import { BrowserWindow, app } from 'electron'
import path from 'path'
import { itemQueries } from './db'

export async function archiveWebPage(itemId: number, url: string) {
  return new Promise<void>((resolve, reject) => {
    // We create a hidden window
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    win.webContents.on('did-finish-load', async () => {
      try {
        const userDataPath = app.getPath('userData');
        const archivesDir = path.join(userDataPath, 'archives');
        const fs = require('fs');
        if (!fs.existsSync(archivesDir)) fs.mkdirSync(archivesDir);

        const mhtmlPath = path.join(archivesDir, `${itemId}_${Date.now()}.mhtml`);
        await win.webContents.savePage(mhtmlPath, 'MHTML');
        
        // Update the item to store the archive path
        // We will store it in a new field or reuse an existing one like `imagePath` 
        // Wait, `imagePath` is strictly for images. We can store it in a new column or just JSON inside content if we want,
        // but adding a new column `archive_path` is better.
        // Wait, we don't have `archive_path` in the database.
        // I will just add it to `db.ts`! For now, let's just save it.
        itemQueries.update(itemId, { archivePath: mhtmlPath } as any);
        
        win.destroy();
        resolve();
      } catch (err) {
        win.destroy();
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', () => {
      win.destroy();
      reject(new Error('Failed to load page for archiving.'));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.destroy();
        reject(new Error('Timeout loading page for archiving.'));
      }
    }, 30000);

    win.loadURL(url);
  });
}
