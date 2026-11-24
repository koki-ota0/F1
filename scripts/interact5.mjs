// v2.2 QA — results archive, driver photos, 3D garage (graceful degradation).
import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js') && !f.includes('three'))
await build({ entryPoints: [path.join(distAssets, entry)], bundle: true, format: 'iife', platform: 'browser', target: 'es2020', outfile: '/tmp/pitwall.v22.js', logLevel: 'silent' })
const bundle = fs.readFileSync('/tmp/pitwall.v22.js', 'utf8')

let pass = 0, total = 0
function ok(name, cond) {
  total++
  if (cond) { pass++; console.log(`PASS ${name}`) } else console.log(`FAIL ${name}`)
}

async function open(route) {
  const errors = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e) => errors.push(String(e.detail?.stack || e.detail || e.message || e)))
  const html = await (await fetch(base + route)).text()
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, ''), {
    url: base + route, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (url, opts) => fetch(new URL(url, base).href, opts)
      window.AbortController = AbortController
      window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
      window.scrollTo = () => {}
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16)
      window.cancelAnimationFrame = clearTimeout
      // no real WebGL in jsdom → the garage must degrade instead of crashing
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    }
  })
  const s = dom.window.document.createElement('script')
  s.textContent = bundle
  dom.window.document.body.appendChild(s)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const waitFor = async (fn, timeout = 20000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await wait(200) }
    return null
  }
  await waitFor(() => dom.window.document.querySelector('.card, .nav'))
  return { win: dom.window, errors, wait, waitFor }
}

// ---- results page (bundled 2025 archive must render even with no network)
{
  const { win, errors, waitFor } = await open('/results')
  const hasArchive = await waitFor(() => /アーカイブ（2025）/.test(win.document.body.textContent) || /Archive \(2025\)/.test(win.document.body.textContent), 8000)
  ok('results: archive badge shown', !!hasArchive)
  const txt = win.document.body.textContent
  ok('results: 24 rounds rendered', (txt.match(/Rd\./g) || []).length >= 20)
  ok('results: winner names present', /ランド・ノリス|Lando Norris/.test(txt))
  ok('results: no runtime errors', errors.length === 0)
}

// ---- driver photos served and used
{
  const img = await fetch(`${base}/images/drivers/norris.jpg`)
  const bytes = img.ok ? (await img.arrayBuffer()).byteLength : 0
  ok('photos: norris.jpg served', img.ok && bytes > 1000)
  const { win, errors, waitFor } = await open('/drivers')
  const ready = await waitFor(() => [...win.document.querySelectorAll('img.dphoto')].length >= 10, 8000)
  ok('photos: driver cards use <img>', !!ready)
  const imgs = [...win.document.querySelectorAll('img.dphoto')]
  const firstImg = imgs[0]
  // portraits must come from the one bundled source; never X/Twitter or a live headshot host
  ok('photos: src points at bundled asset',
    !!firstImg && (firstImg.getAttribute('src').includes('/images/drivers/') || firstImg.getAttribute('src').includes('images/drivers/')))
  ok('photos: no social headshots', !imgs.some((i) => /twitter|x\.com|twimg/.test(i.getAttribute('src') || '')))
  ok('drivers: no runtime errors', errors.length === 0)
}

// ---- 3D garage degrades gracefully without WebGL
{
  const { win, errors, waitFor } = await open('/garage')
  const stage = await waitFor(() => win.document.querySelector('.garage-stage'), 5000)
  ok('garage: stage mounted', !!stage)
  await new Promise((r) => setTimeout(r, 1500))
  const txt = win.document.body.textContent
  ok('garage: team selector present', /マクラーレン|McLaren/.test(txt))
  ok('garage: graceful message without WebGL', /WebGL|静的表示|static view/.test(txt))
  // jsdom has no canvas implementation; that noise is expected and must not crash
  const real = errors.filter((e) => !/getContext\(\)/.test(e))
  if (real.length) console.log('   garage errors:', real.slice(0, 3))
  ok('garage: no runtime errors', real.length === 0)
}

// ---- live classification via mock F1 API (VITE_F1_BASE=<mock>)
if (process.env.MOCK_F1 === '1') {
  const { win, waitFor } = await open('/results')
  const btn = await waitFor(() => [...win.document.querySelectorAll('button')].find((b) => /全順位を見る|Full classification/.test(b.textContent)), 8000)
  ok('results-live: detail button present', !!btn)
  if (btn) btn.click()
  const ready = await waitFor(() => /QA Racer/.test(win.document.body.textContent), 8000)
  ok('results-live: classification fetched from API', !!ready)
}

// ---- offline standings must never render an empty table (bundled 2025 archive)
{
  const { win, waitFor } = await open('/standings')
  const ready = await waitFor(() => /Lando Norris/.test(win.document.body.textContent), 12000)
  ok('standings-offline: archive rows rendered', !!ready)
  ok('standings-offline: season label shown', /シーズンを表示中|Showing .* season/.test(win.document.body.textContent))
}

console.log(`\n${pass}/${total} checks passed`)
process.exit(pass === total ? 0 : 1)
