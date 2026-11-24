#!/usr/bin/env node
/**
 * WCAG AA contrast audit for every route.
 *
 * Unlike a naive "compare text colour to black" check, this walks the ancestor
 * chain and alpha-composites each translucent background, so panels over
 * gradients are measured against what the eye actually sees.
 *
 * Usage:
 *   BASE=http://localhost:3000 node scripts/contrast-audit.mjs
 * Env: BASE (default http://localhost:3000), WIDTHS (default "1440,390")
 */
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const base = process.env.BASE || 'http://localhost:3000'
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number)
const routes = ['/', '/live', '/standings', '/results', '/calendar', '/drivers',
  '/teams', '/predict', '/sim', '/quiz', '/garage', '/news', '/social', '/league', '/fan']

const PROBE = () => {
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map(Number)
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
  }
  const over = (fg, bg) => fg.map((c, i) => (i < 3 ? c * fg[3] + bg[i] * (1 - fg[3]) : 0))
  const bad = []
  document.querySelectorAll('body *').forEach((el) => {
    // decorative layers (watermarks) carry no information
    if (el.closest('[aria-hidden="true"]')) return
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!txt) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    let bg = [0, 0, 0]
    let cur = el
    while (cur && cur !== document.documentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor)
      if (c && c[3] > 0) {
        bg = c[3] === 1 ? [c[0], c[1], c[2]] : over(c, bg)
        if (c[3] === 1) break
      }
      cur = cur.parentElement
    }
    const r = parse(cs.color)
    if (!r) return
    const eff = r[3] === 1 ? [r[0], r[1], r[2]] : over(r, bg)
    const ratio = (Math.max(lum(eff), lum(bg)) + 0.05) / (Math.min(lum(eff), lum(bg)) + 0.05)
    if (ratio < 4.5) {
      bad.push(`${el.tagName}.${String(el.className).slice(0, 24)} "${txt.slice(0, 24)}" ${ratio.toFixed(2)}`)
    }
  })
  return bad.slice(0, 6)
}

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--enable-unsafe-swiftshader'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: null
})

let failures = 0
for (const width of widths) {
  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900 })
    await page.goto(base + route, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 700))
    const bad = await page.evaluate(PROBE)
    const ok = bad.length === 0
    if (!ok) failures++
    console.log(`${ok ? 'PASS' : 'FAIL'} cr ${width} ${route}${ok ? '' : ' :: ' + bad.join(' | ').slice(0, 220)}`)
    await page.close()
  }
}
await browser.close()
console.log(failures ? `\n${failures} contrast issue(s)` : '\nContrast OK')
process.exit(failures ? 1 : 0)
