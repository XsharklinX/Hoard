import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'

export function exportBackup(destPath: string): void {
  const userData  = app.getPath('userData')
  const zip       = new AdmZip()

  const manifest = {
    version:   '1.0',
    app:       'Hoard',
    timestamp: Date.now()
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))

  // Add DB (plain or encrypted)
  for (const dbFile of ['hoard.db', 'hoard.db.enc']) {
    const p = path.join(userData, dbFile)
    if (fs.existsSync(p)) zip.addLocalFile(p, '', dbFile)
  }

  // Add images folder
  const imagesDir = path.join(userData, 'hoard-images')
  if (fs.existsSync(imagesDir)) zip.addLocalFolder(imagesDir, 'images')

  zip.writeZip(destPath)
}

export function importBackup(srcPath: string): void {
  const userData = app.getPath('userData')
  const zip      = new AdmZip(srcPath)

  // Validate manifest
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) throw new Error('Invalid backup: missing manifest.json')
  const manifest = JSON.parse(manifestEntry.getData().toString())
  if (manifest.app !== 'Hoard') throw new Error('Invalid backup: not a Hoard backup')

  // Restore DB files
  for (const dbFile of ['hoard.db', 'hoard.db.enc']) {
    const entry = zip.getEntry(dbFile)
    if (entry) {
      zip.extractEntryTo(entry, userData, false, true)
    }
  }

  // Restore images (merge — don't delete existing)
  const imagesDir = path.join(userData, 'hoard-images')
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
  const imageEntries = zip.getEntries().filter(e => e.entryName.startsWith('images/') && !e.isDirectory)
  for (const entry of imageEntries) {
    const dest = path.join(imagesDir, path.basename(entry.entryName))
    fs.writeFileSync(dest, entry.getData())
  }
}
