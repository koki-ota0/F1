// Manual-refresh QA (GitHub Pages flow): navbar 「更新」 fetches live data
// browser-direct, caches it, updates pages, reports LIVE/OFFLINE.
import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js'))
await build({ entryPoints: [path.join(distAssets, entry)], bundle: true, format: 'iife', platform: 'browser', target: 'es2020', outfile: '/tmp/pitwall.refresh.js', logLevel: 'silent' })
const bundle = fs.readFileSync('/tmp/pitwall.refresh.js', 'utf8')

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
      window.fetch = (url, opts) => { const u = new URL(url, base).href; return fetch(u, opts) }
      window.AbortController = AbortController
      window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
      window.scrollTo = () => {}
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    }
  })
  const s = dom.window.document.createElement('script')
  s.textContent = bundle
  dom.window.document.body.appendChild(s)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const waitFor = async (fn, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await wait(200) }
    return null
  }
  await waitFor(() => dom.window.document.querySelector('.nav'))
  return { win: dom.window, errors, wait, waitFor }
}
const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }))

{
  const { win, errors, wait } = await open('/standings')
  const btn = [...win.document.querySelectorAll('button')].find((b) => /更新|Refresh/.test(b.textContent))
  ok('refresh: navbar button present', !!btn)
  ok('refresh: initial page renders standings', win.document.body.textContent.length > 200)
  if (btn) click(win, btn)
  // refresh runs several season-aware requests; wait until it settles
  let settled = false
  for (let i = 0; i < 30 && !settled; i++) {
    await wait(500)
    settled = !!win.localStorage.getItem('pitwall.live.status')
  }
  await wait(500)
  const txt = win.document.body.textContent
  // sandbox has no outbound F1 API, so the honest outcome is the offline report
  ok('refresh: reports an outcome', /LIVE|オフライン|Offline/.test(txt))
  ok('refresh: status cached in localStorage', !!win.localStorage.getItem('pitwall.live.status'))
  const st = JSON.parse(win.localStorage.getItem('pitwall.live.status') || '{}')
  ok('refresh: status lists per-task results', Array.isArray(st.results) && st.results.length >= 3)
  if (errors.length) console.log('   errors:', errors.slice(0,2)); ok('refresh: no runtime errors', errors.length === 0)
}

// ---- happy path: with a reachable F1 API (mock), refresh must go LIVE and
// propagate into the pages. Enable by building with VITE_F1_BASE=<mock>.
if (process.env.MOCK_F1 === '1') {
  const { win, errors, wait } = await open('/calendar')
  const clickBtn = [...win.document.querySelectorAll('button')].find((b) => /更新|Refresh/.test(b.textContent))
  ok('refresh-mock: button present', !!clickBtn)
  if (clickBtn) click(win, clickBtn)
  // wait for the per-task refresh to settle, then for the page to re-read the cache
  let settled = false
  for (let i = 0; i < 30 && !settled; i++) { await wait(500); settled = !!win.localStorage.getItem('pitwall.live.status') }
  await wait(2500)
  const txt = win.document.body.textContent
  ok('refresh-mock: navbar reports LIVE', /LIVE ✓? \d+\/\d+/.test(txt))
  ok('refresh-mock: calendar shows mocked race', /Mock (Australian|Japanese) Grand Prix/.test(win.localStorage.getItem('pitwall.live.calendar.2026')))
  const cached = JSON.parse(win.localStorage.getItem('pitwall.live.calendar.2026') || '{}')
  ok('refresh-mock: calendar cached', Array.isArray(cached.races) && cached.races.length === 2)
  ok('refresh-mock: no runtime errors', errors.length === 0)

  const st = await open('/standings')
  await st.wait(1500)
  const stBtn = [...st.win.document.querySelectorAll('button')].find((b) => /更新|Refresh/.test(b.textContent))
  if (stBtn) click(st.win, stBtn)
  await st.wait(4000)
  ok('refresh-mock: standings page uses cached mock data', /QA Racer/.test(st.win.document.body.textContent))
  ok('refresh-mock: season-fallback label shown', /シーズンを表示中|Showing .* season/.test(st.win.document.body.textContent))
}

console.log(`\n${pass}/${total} checks passed`)
process.exit(pass === total ? 0 : 1)
