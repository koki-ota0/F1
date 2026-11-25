// v2.4 QA — results archive, driver photos, drawer nav.
import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js'))
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
  await waitFor(() => win.document.querySelectorAll('.round-card').length > 0, 12000)
  const txt = win.document.body.textContent
  ok('results: 23 rounds rendered', (win.document.querySelectorAll('.round-card').length) >= 23)
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

// ---- single-row header + slide-in drawer navigation
{
  const { win, errors, waitFor } = await open('/')
  const burger = await waitFor(() => win.document.querySelector('.burger'), 5000)
  ok('nav: burger present (no inline link row)', !!burger && win.document.querySelectorAll('.nav-links a').length === 0)
  burger.click()
  const drawer = await waitFor(() => win.document.querySelector('.drawer.open'), 3000)
  ok('nav: drawer opens', !!drawer)
  const links = win.document.querySelectorAll('.drawer.open a.drawer-link')
  ok('nav: drawer lists all sections (>= 14)', links.length >= 14)
  ok('nav: no garage route left', !/ガレージ|Garage/.test(win.document.body.textContent))
  ok('nav: no runtime errors', errors.length === 0)
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

// ---- accounts (username + password) and protected fan zone
{
  const uname = `qa_${Date.now().toString(36)}`
  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'qa-pass-1', name: 'QA Fan' })
  })
  const regBody = await reg.json()
  ok('auth: register returns a session token', reg.ok && !!regBody.token && regBody.user?.username === uname)
  const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${regBody.token}` } })
  const meBody = await me.json()
  ok('auth: bearer token resolves the account', me.ok && meBody.user?.id === regBody.user?.id)
  const noauth = await fetch(`${base}/api/auth/me`)
  ok('auth: anonymous /me is rejected (401)', noauth.status === 401)
  const bad = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'wrong-password' })
  })
  ok('auth: wrong password is rejected', bad.status === 401)
  const patched = await fetch(`${base}/api/me`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regBody.token}` },
    body: JSON.stringify({ driver: 'norris', team: 'mclaren', xp: 42 })
  })
  const patchedBody = await patched.json()
  ok('auth: profile update persists', patched.ok && patchedBody.user?.profile?.xp === 42)

  const { win, waitFor } = await open('/fan')
  const locked = await waitFor(() => /ログインが必要|needs an account/.test(win.document.body.textContent), 6000)
  ok('auth: /fan is gated without a session', !!locked)

  // Validation failures must name the actual problem. They used to be collapsed
  // into `invalid_input`, which showed "check your input" for a correctly
  // filled form and gave the user nothing to act on.
  const badShape = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ab', password: 'qa-pass-1' })
  })
  const badShapeBody = await badShape.json()
  ok('auth: short username reports username_format (not invalid_input)',
    badShape.status === 400 && badShapeBody.code === 'username_format')

  const badPw = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `qa_${Date.now().toString(36)}bb`, password: 'abcdefgh' })
  })
  const badPwBody = await badPw.json()
  ok('auth: all-letter password reports password_strength',
    badPw.status === 400 && badPwBody.code === 'password_strength')

  const taken = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'qa-pass-1' })
  })
  const takenBody = await taken.json()
  ok('auth: duplicate username reports username_taken', taken.status === 400 && takenBody.code === 'username_taken')

  // predictions must be scored against the real result, never a simulation
  const season = new Date().getFullYear()
  const predRes = await fetch(`${base}/api/predictions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regBody.token}` },
    body: JSON.stringify({ year: season, round: 1, p1: 'russell' })
  })
  const predBody = await predRes.json()
  ok('predict: submission accepted', predRes.ok || predRes.status === 409)
  const mineRes = await fetch(`${base}/api/predictions/mine`, { headers: { Authorization: `Bearer ${regBody.token}` } })
  const mine = await mineRes.json()
  const scored = (mine.predictions || []).find((p) => p.year === season && p.round === 1)
  ok('predict: real result awarded points', !!scored?.score && scored.score.points >= 10)
  ok('predict: accuracy is reported', typeof scored?.score?.accuracy === 'number')

  const joinRes = await fetch(`${base}/api/leagues/top3-challenge/join`, {
    method: 'POST', headers: { Authorization: `Bearer ${regBody.token}` }
  })
  ok('league: join accepted', joinRes.ok)
  const scoreRes = await fetch(`${base}/api/leagues/top3-challenge/score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regBody.token}` },
    body: JSON.stringify({ year: season, round: 1 })
  })
  const leagueBody = await scoreRes.json()
  const meEntry = leagueBody.league?.entries.find((e) => e.userId === regBody.user?.id)
  ok('league: member entry scored from the real result', scoreRes.ok && (meEntry?.points || 0) >= 2)
}

console.log(`\n${pass}/${total} checks passed`)
process.exit(pass === total ? 0 : 1)
