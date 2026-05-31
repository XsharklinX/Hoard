import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import AdmZip from 'adm-zip'
import Jimp from 'jimp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionDir = path.join(root, 'extension')
const iconsDir = path.join(extensionDir, 'icons')
const distDir = path.join(root, 'dist')
const manifestPath = path.join(extensionDir, 'manifest.json')

const packageFiles = [
  'api.js',
  'background.js',
  'content.js',
  'db.js',
  'i18n.js',
  'icon.png',
  'onboarding.html',
  'onboarding.js',
  'popup.html',
  'popup.js',
  'sidepanel.html',
  'sidepanel.js',
  'sync-core.js',
]

fs.mkdirSync(iconsDir, { recursive: true })
fs.mkdirSync(distDir, { recursive: true })

const sourceIcon = await Jimp.read(path.join(extensionDir, 'icon.png'))
for (const size of [16, 32, 48, 128]) {
  const icon = new Jimp(size, size, 0x00000000)
  const inset = size === 128 ? 16 : Math.max(1, Math.round(size * 0.08))
  const contentSize = size - inset * 2
  const resized = sourceIcon.clone().contain(contentSize, contentSize)
  icon.composite(resized, inset, inset)
  await icon.writeAsync(path.join(iconsDir, `icon${size}.png`))
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
function createPackage(browser, sourceManifest) {
  const packageManifest = JSON.parse(fs.readFileSync(path.join(extensionDir, sourceManifest), 'utf8'))
  const zipPath = path.join(distDir, `hoard-extension-${browser}-v${packageManifest.version}.zip`)
  const zip = new AdmZip()
  for (const file of packageFiles) {
    zip.addLocalFile(path.join(extensionDir, file))
  }
  zip.addLocalFolder(iconsDir, 'icons')
  zip.addLocalFolder(path.join(extensionDir, '_locales'), '_locales')
  zip.addFile('manifest.json', fs.readFileSync(path.join(extensionDir, sourceManifest)))
  zip.writeZip(zipPath)
  console.log(`Created ${path.relative(root, zipPath)}`)
}

const browser = process.argv[2] || 'chrome'
if (browser === 'all') {
  createPackage('chrome', 'manifest.json')
  createPackage('firefox', 'manifest.firefox.json')
} else if (browser === 'firefox') {
  createPackage('firefox', 'manifest.firefox.json')
} else {
  createPackage('chrome', 'manifest.json')
}
