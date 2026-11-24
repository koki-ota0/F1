#!/usr/bin/env node
// Capture every route at desktop + mobile widths for a visual UI review.
import fs from 'node:fs'
import path from 'node:path'

let chromium, puppeteer
try {
  chromium = (await import('@sparticuz/chromium')).default
  puppeteer = (await import('puppeteer-core')).default
} catch {
  console.error('needs @sparticuz/chromium + puppeteer-core')
  process.exit(0)
}

const base = process.env.BASE || 'http://localhost:3000'
const outDir = process.env.OUT || path.join(process.cwd(), 'qa', 'ui')
fs.mkdirSync(outDir, { recursive: true })

const routes = [
  '/', '/live', '/standings', '/results', '/calendar', '/drivers', '/teams',
  '/predict', '/sim', '/quiz', '/login', '/news', '/social', '/league', '/fan',
  '/drivers/verstappen', '/teams/ferrari'
]

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: null
})

for (const [width, height, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    const name = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '')
    try {
      await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
      await new Promise((r) => setTimeout(r, 2600))
      await page.screenshot({ path: path.join(outDir, `${tag}-${name}.png`), fullPage: false })
      // also record layout metrics used for the responsive audit
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        tables: [...document.querySelectorAll('table.table')].map((t) => t.getBoundingClientRect().width),
        cards: document.querySelectorAll('.card').length,
        buttons: [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => ({ t: b.textContent.trim().slice(0, 18), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })),
        imgsBroken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'))
      }))
      fs.writeFileSync(path.join(outDir, `${tag}-${name}.json`), JSON.stringify(m, null, 1))
    } catch (e) {
      console.log(`ERR ${tag} ${route} :: ${String(e?.message || e).slice(0, 120)}`)
    }
    await page.close()
  }
}
await browser.close()
console.log(`shots → ${outDir}`)
