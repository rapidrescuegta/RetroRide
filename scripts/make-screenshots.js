// Regenerate the PWA manifest screenshots against the live site.
//
// public/manifest.json referenced /screenshots/home-wide.png,
// /screenshots/home-narrow.png and /screenshots/gameplay-narrow.png — none of
// them existed, so every install prompt that tries to show a screenshot gets a
// 404. This captures them at the exact sizes the manifest declares.
//
// Usage: node scripts/make-screenshots.js [baseUrl]
const path = require('path')
const fs = require('fs')

const PW = '/home/gracco/.npm-global/lib/node_modules/playwright'
const { chromium } = require(PW)

const BASE = process.argv[2] || 'https://www.gamebuddi.com'
const OUT = path.join(__dirname, '..', 'public', 'screenshots')

const SHOTS = [
  { file: 'home-wide.png', url: '/', width: 1280, height: 720, wait: 2500 },
  { file: 'home-narrow.png', url: '/', width: 750, height: 1334, wait: 2500 },
  { file: 'gameplay-narrow.png', url: '/play/snake', width: 750, height: 1334, wait: 3500 },
]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  for (const shot of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    })
    const page = await ctx.newPage()
    await page.goto(BASE + shot.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(shot.wait)
    const file = path.join(OUT, shot.file)
    await page.screenshot({ path: file })
    console.log('wrote', path.relative(process.cwd(), file), shot.width + 'x' + shot.height)
    await ctx.close()
  }
  await browser.close()
})().catch((e) => {
  console.error('ERR', e)
  process.exit(1)
})
