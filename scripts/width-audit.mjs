#!/usr/bin/env node
/**
 * Horizontal-overflow audit across a range of viewport widths.
 *
 * "Works at any screen size" is a claim you can measure: for each width we load
 * every route and report any element wider than the viewport, excluding the two
 * intentional scroll containers (the news ticker marquee and `.table-wrap`,
 * which pans sideways by design).
 *
 * Usage:
 *   BASE=http://localhost:3000 node scripts/width-audit.mjs
 * Env: BASE (default http://localhost:3000), WIDTHS (default 1280..360)
 */
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const base = process.env.BASE || 'http://localhost:3000'
const widths = (process.env.WIDTHS || '1280,1181,1100,1024,900,768,720,600,480,414,390,360')
  .split(',').map(Number)
const routes = ['/', '/live', '/standings', '/results', '/calendar', '/drivers',
  '/teams', '/predict', '/sim', '/quiz', '/garage', '/news', '/social', '/league', '/fan']

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--enable-unsafe-swiftshader'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: null
})

let failures = 0
for (const width of widths) {
  const offenders = []
  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900 })
    await page.goto(base + route, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 450))
    const res = await page.evaluate(() => {
      const over = []
      document.querySelectorAll('body *').forEach((el) => {
        if (el.closest('.ticker') || el.closest('.table-wrap')) return
        const rc = el.getBoundingClientRect()
        if (rc.width > window.innerWidth + 2) {
          over.push(`${el.tagName}.${String(el.className).slice(0, 20)} w=${Math.round(rc.width)}`)
        }
      })
      return { doc: document.documentElement.scrollWidth, over: over.slice(0, 3) }
    })
    if (res.doc > width + 1 || res.over.length) offenders.push(`${route} docW=${res.doc} ${res.over.join(',')}`)
    await page.close()
  }
  if (offenders.length) failures++
  console.log(`${offenders.length ? 'FAIL' : 'PASS'} w=${width}${offenders.length ? ' :: ' + offenders.slice(0, 3).join(' | ') : ''}`)
}
await browser.close()
console.log(failures ? `\n${failures} width(s) with overflow` : '\nNo horizontal overflow at any tested width')
process.exit(failures ? 1 : 0)
