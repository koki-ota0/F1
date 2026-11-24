#!/usr/bin/env node
// Designer audit: measure real computed styles/layout on every route at two
// widths and print the numbers we need to judge UI quality (no screenshots).
import fs from 'node:fs'
import path from 'node:path'

const chromium = (await import('@sparticuz/chromium')).default
const puppeteer = (await import('puppeteer-core')).default

const base = process.env.BASE || 'http://localhost:3000'
const out = {}
const routes = [
  '/', '/live', '/standings', '/results', '/calendar', '/drivers', '/teams',
  '/predict', '/sim', '/quiz', '/news', '/social', '/league', '/fan',
  '/drivers/verstappen', '/teams/ferrari'
]

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: null
})

const AUDIT = () => {
  const px = (v) => parseFloat(v) || 0
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
  // relative luminance contrast
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
      const s = Number(v) / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const bgOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c
      n = n.parentElement
    }
    return 'rgb(7, 8, 13)'
  }
  const contrast = (fg, bg) => {
    const L1 = lum(fg); const L2 = lum(bg)
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  }

  const smallText = []
  const smallTargets = []
  const lowContrast = []
  const wide = []
  const noAlt = []
  const tallRows = []

  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && el.tagName !== 'HTML') continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const key = `${el.tagName}.${cs.fontSize}`
    if ((el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'A' || el.tagName === 'TD' || el.tagName === 'LI') && el.textContent.trim()) {
      const fs2 = px(cs.fontSize)
      if (fs2 < 11 && !seen.has(key)) { smallText.push(`${el.tagName} ${cs.fontSize} "${el.textContent.trim().slice(0, 24)}"`); seen.add(key) }
      const fg = cs.color, bg = bgOf(el)
      const cr = contrast(fg, bg)
      if (cr < 3.4 && fs2 < 16 && !seen.has('c' + key)) { lowContrast.push(`${el.tagName} ${cs.fontSize} cr=${cr.toFixed(2)} "${el.textContent.trim().slice(0, 20)}"`); seen.add('c' + key) }
    }
    // inline links inside running text are exempt from the 38px tap rule
    const inlineLink = el.classList?.contains('inline-link')
    if (!inlineLink && (el.tagName === 'BUTTON' || el.tagName === 'A') && el.textContent.trim()) {
      const rr = rect(el)
      if (rr.h > 0 && rr.h < 38) smallTargets.push(`${el.tagName} "${el.textContent.trim().slice(0, 20)}" ${rr.w}x${rr.h}`)
    }
    if (r.width > window.innerWidth + 2) wide.push(`${el.tagName}.${cs.className?.toString().slice(0, 24)} w=${Math.round(r.width)}`)
    if (el.tagName === 'IMG' && !el.getAttribute('alt')) noAlt.push(el.getAttribute('src'))
  }
  // table scroll need
  const scrollTables = [...document.querySelectorAll('.table-wrap')].filter((w) => w.scrollWidth > w.clientWidth + 2)
    .map((w) => ({ client: w.clientWidth, scroll: w.scrollWidth }))
  const cols = {}
  for (const g of document.querySelectorAll('.grid, .footer .fgrid, .weather-grid')) {
    const n = getComputedStyle(g).gridTemplateColumns.split(' ').length
    cols[`${g.className}|${n}`] = (cols[`${g.className}|${n}`] || 0) + 1
  }
  return {
    vw: window.innerWidth,
    bodyFont: getComputedStyle(document.body).fontSize,
    smallText: [...new Set(smallText)].slice(0, 12),
    lowContrast: [...new Set(lowContrast)].slice(0, 10),
    smallTargets: [...new Set(smallTargets)].slice(0, 12),
    wide: [...new Set(wide)].slice(0, 8),
    noAlt: noAlt.slice(0, 5),
    scrollTables,
    grids: cols,
    docH: document.documentElement.scrollHeight
  }
}

for (const [width, tag] of [[1440, 'd'], [390, 'm']]) {
  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
    const name = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '')
    try {
      await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
      await new Promise((r) => setTimeout(r, 1800))
      out[`${tag}-${name}`] = await page.evaluate(AUDIT)
    } catch (e) { out[`${tag}-${name}`] = { err: String(e.message).slice(0, 120) } }
    await page.close()
  }
}
await browser.close()
fs.writeFileSync(process.env.OUT || 'qa/ui-audit.json', JSON.stringify(out, null, 1))

for (const [k, v] of Object.entries(out)) {
  if (v.err) { console.log(`${k.padEnd(22)} ERR ${v.err}`); continue }
  const flag = (arr) => (arr?.length ? `!(${arr.length})` : 'ok')
  console.log(`${k.padEnd(22)} smallText=${flag(v.smallText)} lowContrast=${flag(v.lowContrast)} smallTargets=${flag(v.smallTargets)} wide=${flag(v.wide)} noAlt=${flag(v.noAlt)} scrollTables=${v.scrollTables?.length || 0}`)
  ;(v.smallText || []).slice(0, 4).forEach((s) => console.log(`     text  ${s}`))
  ;(v.lowContrast || []).slice(0, 4).forEach((s) => console.log(`     cr    ${s}`))
  ;(v.smallTargets || []).slice(0, 4).forEach((s) => console.log(`     tap   ${s}`))
  ;(v.wide || []).slice(0, 3).forEach((s) => console.log(`     wide  ${s}`))
}
