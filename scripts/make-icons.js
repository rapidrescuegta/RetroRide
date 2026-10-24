// Regenerate the PWA icon set from the master artwork.
//
// The repo shipped JPEGs named .png/.ico:
//   icon-192.png / icon-512.png / favicon.png -> actually JPEG, 1024x1024
//   favicon.ico                              -> actually JPEG (no ICO header!)
// The manifest declares them as image/png, and the three /screenshots/*.png it
// references did not exist at all (404).
//
// This script writes real PNGs at the sizes the manifest declares, with the
// area outside the rounded square made transparent so the icon sits cleanly on
// the app's dark background, and builds a valid favicon.ico.
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = '/home/gracco/retroride'
const PUB = path.join(ROOT, 'public')
const MASTER = path.join(ROOT, 'assets', 'icon-master.jpg')
const CORNER_RATIO = 0.215 // matches the rounded square in the source artwork

async function roundedAlpha(size, radius) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>
     </svg>`
  )
}

async function makeIcon(size, out) {
  const radius = Math.round(size * CORNER_RATIO)
  const mask = await roundedAlpha(size, radius)
  await sharp(MASTER)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log('wrote', path.relative(process.cwd(), out), size + 'x' + size)
}

// Minimal but valid .ico containing a single 32x32 PNG image.
// (PNG-compressed ICO entries are supported by every browser since IE11.)
function makeIco(pngBuf, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size === 256 ? 0 : size, 0) // width (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1) // height
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)
  return Buffer.concat([header, entry, pngBuf])
}

;(async () => {
  await makeIcon(192, path.join(PUB, 'icon-192.png'))
  await makeIcon(512, path.join(PUB, 'icon-512.png'))
  await makeIcon(180, path.join(PUB, 'icon-180.png'))
  await makeIcon(64, path.join(PUB, 'favicon.png'))

  const icoPng = await sharp(MASTER)
    .resize(32, 32, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: await roundedAlpha(32, Math.round(32 * CORNER_RATIO)), blend: 'dest-in' }])
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(PUB, 'favicon.ico'), makeIco(icoPng, 32))
  console.log('wrote public/favicon.ico (valid ICO, 32x32 PNG entry)')
})().catch((e) => {
  console.error('ERR', e)
  process.exit(1)
})
