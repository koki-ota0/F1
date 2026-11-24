#!/usr/bin/env node
// Real-browser QA (headless Chromium via @sparticuz/chromium + puppeteer-core).
// Sandboxes usually cannot reach api.openf1.org, so point the app at a local
// fixture server first:
//   VITE_OPENF1_BASE=http://127.0.0.1:4180/f1 npm run build
//   PITWALL_OPENF1_BASE=http://127.0.0.1:4180/f1 node server/index.js
// and run this script with LD_LIBRARY_PATH pointing at the extracted NSS libs.
import fs from 'node:fs'
import path from 'node:path'

let chromium, puppeteer
try {
  chromium = (await import('@sparticuz/chromium')).default
  puppeteer = (await import('puppeteer-core')).default
} catch {
  console.error('browser QA needs @sparticuz/chromium + puppeteer-core (dev deps). Skipping.')
  process.exit(0)
}

const base = process.env.BASE || 'http://localhost:3000'
const outDir = path.join(process.cwd(), 'qa')
fs.mkdirSync(outDir, { recursive: true })

const routes = [
  ['results-desktop', '/results', 1440, 900],
  ['standings-desktop', '/standings', 1440, 900],
  ['live-desktop', '/live', 1440, 900],
  ['calendar-desktop', '/calendar', 1440, 900],
  ['home-desktop', '/', 1440, 900],
  ['results-mobile', '/results', 390, 844],
  ['standings-mobile', '/standings', 390, 844],
  ['live-mobile', '/live', 390, 844]
]

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: null
})

let failures = 0
const ok = (name, cond, extra = '') => {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra.slice(0, 160) : ''}`)
}

for (const [name, route, width, height] of routes) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  const errors = []
  const failed = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e?.message || e)))
  page.on('requestfailed', (r) => failed.push(`${r.resourceType()}:${r.url()}`))
  try {
    await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
    await new Promise((r) => setTimeout(r, 1000))
    const text = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' ').trim())
    // let late-arriving live tiers settle before asserting
    const settle = async (re, ms = 45000) => {
      const t0 = Date.now()
      try {
        for (;;) {
          if (new RegExp(re.source).test(await page.evaluate(() => document.body.textContent))) return true
          if (Date.now() - t0 > ms) return false
          await new Promise((r) => setTimeout(r, 1200))
        }
      } catch { return false }
    }
    if (name.startsWith('results')) await settle(/Grand Prix/)
    if (name.startsWith('standings')) await settle(/Antonelli|アントネッリ/)
    if (name.startsWith('live')) await settle(/Verstappen|フェルスタッペン/)
    // Re-read after settling so text-based assertions see the final render.
    const text2 = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' ').trim())
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false })
    const hasRoot = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
    ok(`browser:${name} renders`, hasRoot && text.length > 200, text.slice(0, 120))
    // Fonts/CDN may be unreachable from a sandbox; report but do not fail on them.
    const appErrors = errors.filter((e) => !/fonts\.|ERR_CONNECTION_CLOSED/.test(e))
    ok(`browser:${name} no app console errors`, appErrors.length === 0, appErrors.slice(0, 3).join(' | '))
    ok(`browser:${name} no layout overflow`, await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth + 1))
    if (name.startsWith('results')) {
      ok(`browser:${name} 2026 season tab`, /2026/.test(text2))
      ok(`browser:${name} shows 2026 winners`, /Russell|ラッセル|Verstappen|フェルスタッペン|Antonelli|アントネッリ/.test(text2), text2.slice(0, 80))
      ok(`browser:${name} no stale-only 2025 label`, !/Archive \(2025\)/.test(text2))
      ok(`browser:${name} round cards present`, await page.evaluate(() =>
        [...document.querySelectorAll('.card h4')].some((h) => /Grand Prix/.test(h.textContent))))
    }
    if (name.startsWith('standings')) {
      ok(`browser:${name} 2026 WDC leader`, /Antonelli|アントネッリ/.test(text2) && /402/.test(text2), text2.slice(0, 80))
      ok(`browser:${name} championship 2026`, /CHAMPIONSHIP\s*2026/.test(text2))
      const rows = await page.evaluate(() => document.querySelectorAll('table tbody tr').length)
      ok(`browser:${name} standings rows >= 20`, rows >= 20, `rows=${rows} text=${text2.slice(0, 60)}`)
    const data = await page.evaluate(() => window.__PITWALL_DEBUG__?.standings ?? null)
    if (data) ok(`browser:${name} api payload 25 rows`, Array.isArray(data.standings) && data.standings.length === 25, `n=${data.standings?.length}`)
    }
    if (name.startsWith('live')) {
      ok(`browser:${name} openf1 data`, /OpenF1/.test(text2))
      ok(`browser:${name} verstappen classified`, /Verstappen/.test(text2))
      const rows = await page.evaluate(() => document.querySelectorAll('table tbody tr').length)
      ok(`browser:${name} timing rows >= 18`, rows >= 18, `rows=${rows}`)
    }
  } catch (e) {
    failures++
    console.log(`FAIL browser:${name} exception :: ${String(e?.message || e).slice(0, 200)}`)
  }
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} browser check(s) failed` : '\nAll browser checks OK')
process.exit(failures ? 1 : 0)
