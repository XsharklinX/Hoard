import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Jimp from 'jimp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'store-assets')
fs.mkdirSync(output, { recursive: true })

const colors = {
  bg: 0x0e0e10ff,
  surface: 0x18181cff,
  card: 0x1f1f25ff,
  border: 0x353541ff,
  gold: 0xc9952aff,
  green: 0x4ade80ff,
  text: 0xf0f0f4ff,
  muted: 0xa0a0b0ff,
}

const [font16, font32, font64] = await Promise.all([
  Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
  Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
  Jimp.loadFont(Jimp.FONT_SANS_64_WHITE),
])
const icon = await Jimp.read(path.join(root, 'extension', 'icon.png'))

function rect(image, x, y, width, height, color) {
  image.scan(x, y, width, height, function setPixel(px, py) {
    this.setPixelColor(color, px, py)
  })
}

function line(image, x, y, width, color, height = 2) {
  rect(image, x, y, width, height, color)
}

function text(image, font, x, y, value, width = image.bitmap.width - x) {
  image.print(font, x, y, { text: value, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT }, width)
}

function frame(title, subtitle) {
  const image = new Jimp(1280, 800, colors.bg)
  rect(image, 0, 0, 1280, 9, colors.gold)
  image.composite(icon.clone().contain(64, 64), 86, 68)
  text(image, font32, 170, 76, 'HOARD')
  text(image, font64, 86, 172, title, 1080)
  text(image, font32, 90, 260, subtitle, 1040)
  return image
}

async function writeFeatureOffline() {
  const image = frame('Save now. Sync later.', 'Capture links, notes, images and quotes even when Hoard Desktop is closed.')
  rect(image, 86, 370, 1108, 300, colors.surface)
  rect(image, 122, 414, 500, 206, colors.card)
  text(image, font32, 158, 450, 'Offline capture')
  text(image, font16, 158, 510, 'Saved locally in your browser')
  line(image, 158, 555, 340, colors.border, 4)
  line(image, 158, 584, 250, colors.border, 4)
  rect(image, 676, 414, 480, 206, colors.card)
  text(image, font32, 712, 450, 'Automatic retry')
  text(image, font16, 712, 510, 'Pending items sync after reconnect')
  line(image, 712, 555, 320, colors.green, 4)
  line(image, 712, 584, 210, colors.border, 4)
  await image.writeAsync(path.join(output, 'screenshot-01-offline-1280x800.png'))
}

async function writeFeatureOrganize() {
  const image = frame('Your web collection, organized.', 'Search recent captures, filter by type and keep everything on your computer.')
  rect(image, 86, 370, 1108, 300, colors.surface)
  rect(image, 122, 408, 1036, 54, colors.card)
  text(image, font16, 152, 426, 'Search your collection...')
  const rows = [
    ['Saved article', 'example.com', colors.green],
    ['Design inspiration', 'image capture', colors.gold],
    ['Project note', 'local note', colors.green],
  ]
  rows.forEach(([title, meta, color], index) => {
    const y = 488 + index * 54
    rect(image, 122, y, 1036, 42, colors.card)
    rect(image, 145, y + 15, 12, 12, color)
    text(image, font16, 184, y + 5, title)
    text(image, font16, 780, y + 5, meta)
  })
  await image.writeAsync(path.join(output, 'screenshot-02-library-1280x800.png'))
}

async function writeFeaturePrivacy() {
  const image = frame('Local-first by design.', 'Your saved content stays in the browser and syncs only to Hoard Desktop on this computer.')
  rect(image, 86, 370, 1108, 300, colors.surface)
  image.composite(icon.clone().contain(128, 128), 156, 452)
  text(image, font32, 340, 432, 'Browser extension')
  text(image, font16, 340, 496, 'Local IndexedDB outbox')
  line(image, 598, 508, 156, colors.gold, 5)
  text(image, font32, 796, 432, 'Hoard Desktop')
  text(image, font16, 796, 496, '127.0.0.1 local sync')
  text(image, font16, 340, 570, 'No developer-operated cloud service required')
  await image.writeAsync(path.join(output, 'screenshot-03-local-sync-1280x800.png'))
}

async function writePromo() {
  const image = new Jimp(440, 280, colors.bg)
  rect(image, 0, 0, 440, 7, colors.gold)
  image.composite(icon.clone().contain(82, 82), 34, 42)
  text(image, font32, 138, 57, 'HOARD')
  text(image, font32, 34, 154, 'Save the web locally.', 370)
  text(image, font16, 36, 214, 'Offline capture. Desktop sync.', 370)
  await image.writeAsync(path.join(output, 'promo-440x280.png'))
}

await Promise.all([
  writeFeatureOffline(),
  writeFeatureOrganize(),
  writeFeaturePrivacy(),
  writePromo(),
])

console.log(`Created Chrome Web Store assets in ${path.relative(root, output)}`)
