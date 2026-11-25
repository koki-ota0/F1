// QA for the 2026 calendar + portraits + news + standings fixes.
import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
process.on('unhandledRejection', (e) => { console.error('UNHANDLED', e); process.exit(2) })
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js') && !f.includes('three'))
await build({ entryPoints: [path.join(distAssets, entry)], bundle: true, format: 'iife', platform: 'browser', target: 'es2020', outfile: '/tmp/pitwall.verify.js', logLevel: 'silent' })
const bundle = fs.readFileSync('/tmp/pitwall.verify.js', 'utf8')

const apiFlagOf = (html) => /__PITWALL_API__=(true|false)/.exec(html)?.[1]

let pass = 0, total = 0
function ok(name, cond, extra = '') {
  total++
  if (cond) { pass++; console.log(`PASS ${name}`) } else { console.log(`FAIL ${name} ${extra}`) }
}

async function open(route) {
  const errors = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e) => errors.push(String(e.detail?.stack || e.detail || e.message || e)))
  const html = await (await fetch(base + route)).text()
  const apiFlag = /__PITWALL_API__=(true|false)/.exec(html)?.[1]
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, ''), {
    url: base + route, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      // the build reads this before React mounts; without it jsdom assumes a
      // server-backed host and the account UI would never be switched off
      window.__PITWALL_API__ = apiFlag === 'true'
      window.fetch = (url, opts) => fetch(new URL(url, base).href, opts)
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
  void wait
  const waitFor = async (fn, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await wait(200) }
    return null
  }
  await waitFor(() => dom.window.document.querySelector('.card, .nav'))
  return { win: dom.window, errors, wait, waitFor }
}

// ---- calendar: 23 rounds, official names, drill-down detail
{
  const { win, errors, waitFor } = await open('/calendar')
  // wait until the calendar cards themselves are rendered (nav renders first)
  const ready = await waitFor(() => win.document.querySelectorAll('button').length >= 8, 9000)
  const roundCount = (win.document.body.textContent.match(/Rd\./g) || []).length
  ok('calendar: 23 rounds rendered', !!ready && roundCount >= 23, 'buttons=' + win.document.querySelectorAll('button').length + ' rounds=' + roundCount)
  const txt = win.document.body.textContent
  ok('calendar: official round 16 is Sepang-hosted Bahrain GP', /バーレーンGP（マレーシア）|Bahrain Grand Prix in Malaysia/.test(txt))
  ok('calendar: no cancelled Saudi round', !/サウジアラビア|Saudi Arabia GP|サウジGP/.test(txt), txt.match(/サウジ[^\s]*/)?.[0])
  const detailShown = await (async () => {
    const btns = [...win.document.querySelectorAll('button')]
    const btn = btns.find((b) => /概要|overview/i.test(b.textContent))
    if (!btn) return 'no-button:' + btns.map((b) => b.textContent.trim()).join('|')
    btn.click()
    let t = ''
    for (let i = 0; i < 30; i++) {
      t = win.document.body.textContent
      if (/セッション日程|Session schedule/.test(t)) break
      await wait(200)
    }
    return /FP1/.test(t) ? 'yes' : 'no-fp1'
  })()
  ok('calendar: session times shown on drill-down', detailShown === 'yes', detailShown)
  ok('calendar: official race page link present', [...win.document.querySelectorAll('a')].some((a) => /formula1\.com\/en\/racing\/2026\//.test(a.getAttribute('href') || '')))
  ok('calendar: no runtime errors', errors.length === 0)
}

// ---- drivers: #31/#22/#50 named, portrait source unified
{
  const srv = await (await fetch(`${base}/api/standings?year=2026&type=drivers`)).json()
  const rows = srv.standings || []
  const byNum = Object.fromEntries(rows.map((r) => [r.number, r.name]))
  ok('standings: #31 has a real name', byNum[31] === 'Esteban Ocon', byNum[31])
  ok('standings: #22 has a real name', byNum[22] === 'Yuki Tsunoda', byNum[22])
  ok('standings: #50 has a real name', byNum[50] === 'Ryo Hirakawa', byNum[50])

  const { win, waitFor } = await open('/drivers')
  const ready = await waitFor(() => [...win.document.querySelectorAll('img.dphoto')].length >= 15, 8000)
  ok('drivers: cards render', !!ready)
  const srcs = [...win.document.querySelectorAll('img.dphoto')].map((i) => i.getAttribute('src'))
  ok('drivers: all portraits from bundled source', srcs.length > 0 && srcs.every((s) => /images\/drivers\/[a-z]+\.(jpg|png)/.test(s)), srcs.slice(0, 3))
  ok('drivers: ocon/tsunoda/hirakawa listed', ['ocon.jpg', 'tsunoda.jpg', 'hirakawa.jpg'].every((f) => srcs.some((s) => s.includes(f))))
}

// ---- news: every item links to its source
{
  const { win, waitFor } = await open('/news')
  const ready = await waitFor(() => [...win.document.querySelectorAll('a[href^="http"]')].length >= 8, 9000)
  ok('news: articles rendered', !!ready)
  await waitFor(() => /formula1\.com\/en\/latest\/article/.test(win.document.body.textContent), 6000)
  const hrefs = [...win.document.querySelectorAll('a.card')].map((a) => a.getAttribute('href')).filter(Boolean)
  ok('news: every article links to formula1.com', hrefs.length > 0 && hrefs.every((h) => /^https:\/\/www\.formula1\.com\/en\/latest\/article\//.test(h)), hrefs.slice(0, 2))
}

// ---- race results: full classification available, no "bundled" banner
{
  // A static host has no /api/results; the page still opens the baked copy
  // through the client fallback, so only the direct API probe is server-only.
  const apiHost = apiFlagOf(await (await fetch(base + '/login')).text()) === 'true'
  if (apiHost) {
  const srv = await (await fetch(`${base}/api/results?year=2026&round=21`)).json()
  const rows = srv.classification || []
  ok('results: Rd.21 classification served', rows.length >= 20, 'rows=' + rows.length)
  ok('results: Rd.21 winner is Verstappen', rows[0]?.number === 3, JSON.stringify(rows[0]))
  }

  // the baked fallback must carry a classification for every finished round
  const baked = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'server', 'data', 'results-2026.json'), 'utf8'))
  const withClass = baked.rounds.filter((r) => r.status === 'completed' && r.classification?.length >= 20).length
  const completed = baked.rounds.filter((r) => r.status === 'completed').length
  ok('results: baked snapshot has every classification', withClass === completed && completed >= 21, `${withClass}/${completed}`)
  ok('results: baked snapshot retrieved after Rd.21', /2026-11-24/.test(baked.retrievedAt || ''), baked.retrievedAt)

  const { win, errors, waitFor, wait } = await open('/results')
  await waitFor(() => win.document.querySelectorAll('.round-card').length >= 23, 9000)
  const txt = win.document.body.textContent
  ok('results: bundled-snapshot banner removed', !/バンドル（2026）|Bundled \(2026\)/.test(txt))
  ok('results: latest race card present', /ラスベガスGP|Las Vegas Grand Prix/.test(txt))
  const opened = await (async () => {
    const cards = [...win.document.querySelectorAll('.round-card')]
    const idx = cards.findIndex((c) => /ラスベガス|Las Vegas/.test(c.textContent))
    if (idx < 0) return 'no-card'
    cards[idx].querySelector('.round-toggle')?.click()
    for (let i = 0; i < 40; i++) {
      await wait(200)
      const n = win.document.querySelectorAll('#classification tbody tr').length
      if (n >= 20) return n
    }
    return 'rows:' + win.document.querySelectorAll('#classification tbody tr').length
  })()
  ok('results: full classification opens from the card', typeof opened === 'number' && opened >= 20, String(opened))
  ok('results: no runtime errors', errors.length === 0)
}

// ---- accounts are on for a server host, off for a static host (§25)
{
  const isStatic = apiFlagOf(await (await fetch(base + '/login')).text()) === 'false'

  const { win, waitFor } = await open('/login')
  await waitFor(() => win.document.querySelector('.card'), 8000)
  const body = win.document.body.textContent
  const hasForm = !!win.document.querySelector('#auth-username')
  if (isStatic) {
    ok('static host: /login explains accounts are off', /アカウント機能をオフ|Accounts are turned off/.test(body))
    ok('static host: no sign-in form', !hasForm)
    ok('static host: header shows no login chip', !win.document.querySelector('.nav .user-chip'))
    for (const route of ['/fan', '/predict', '/league']) {
      const r = await open(route)
      await r.waitFor(() => (r.win.document.querySelector('main')?.textContent.length || 0) > 300, 9000)
      // scope to <main>: the drawer also links to /login, and the lock glyph in
      // the nav is not a login wall
      const txt = r.win.document.querySelector('main')?.textContent || ''
      ok(`static host: ${route} not walled off by login`,
        !/ログインが必要|needs an account/.test(txt), txt.slice(0, 60))
    }
  } else {
    ok('server host: /login renders the form', hasForm)
    ok('server host: header shows the login chip', !!win.document.querySelector('.nav .user-chip'))
    const r = await open('/fan')
    const locked = await r.waitFor(() => /ログインが必要|needs an account/.test(r.win.document.body.textContent), 8000)
    ok('server host: /fan still gated', !!locked)
  }
}

console.log(`\n${pass}/${total} checks passed`)
process.exit(pass === total ? 0 : 1)
