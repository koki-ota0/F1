import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js'))
const outfile = '/tmp/pitwall.classic.js'
await build({ entryPoints: [path.join(distAssets, entry)], bundle: true, format: 'iife', platform: 'browser', target: 'es2020', outfile, logLevel: 'silent' })
const bundle = fs.readFileSync(outfile, 'utf8')

async function open(route) {
  const errors = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e) => errors.push(String(e.detail || e.message || e)))
  vc.on('error', (m) => errors.push(String(m)))
  const html = await (await fetch(base + route)).text()
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, ''), {
    url: base + route, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
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
  const waitFor = async (fn, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const v = fn()
      if (v) return v
      await wait(200)
    }
    return null
  }
  return { dom, wait, waitFor, errors, doc: dom.window.document, win: dom.window }
}

const results = []
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`) }

// --- AI prediction on /predict ---
{
  const { dom, waitFor, doc, errors, win } = await open('/predict')
  const btn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('AI予測を実行')))
  check('ai: run button rendered', !!btn)
  if (btn) {
    btn.click()
    const bar = await waitFor(() => doc.querySelector('.progress i'))
    check('ai: probability bars rendered', !!bar)
    const rec = await waitFor(() => doc.body.textContent.includes('AIおすすめ'))
    check('ai: recommendation panel shown', !!rec)
    const useBtn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('この予測を採用')))
    check('ai: apply button found', !!useBtn)
    if (useBtn) {
      useBtn.click()
      await new Promise((r) => setTimeout(r, 500))
      const selects = [...doc.querySelectorAll('select.input')]
      const picks = selects.filter((s) => ['p1', 'p2', 'p3'].includes(s.getAttribute('data-pick')) || true)
      // P1-P3/FL are selects index 1..4 in the grid (race is index 0)
      const vals = picks.slice(1, 5).map((s) => s.value)
      check('ai: picks applied to form', vals.every(Boolean), JSON.stringify(vals))
      const toast = doc.body.textContent.includes('反映しました')
      check('ai: applied toast', toast)
    }
  }
  check('ai: no runtime errors', errors.length === 0, errors.slice(0, 2).join('|'))
  dom.window.close()
}

// --- Fan SNS on /social ---
{
  const { dom, waitFor, doc, errors, win } = await open('/social')
  const textarea = await waitFor(() => doc.querySelector('textarea'))
  check('sns: compose box rendered', !!textarea)
  const seedCount = (doc.querySelectorAll('.card') || []).length
  if (textarea) {
    const setInput = (el, v) => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
      el.dispatchEvent(new win.Event('input', { bubbles: true }))
    }
    setInput(textarea, 'スプリントレースのアレ、今年も楽しみすぎる #Sprint')
    const postBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === '投稿する')
    check('sns: post button found', !!postBtn && !postBtn.disabled)
    if (postBtn && !postBtn.disabled) {
      postBtn.click()
      const mine = await waitFor(() => doc.body.textContent.includes('スプリントレースのアレ'))
      check('sns: my post appears in timeline', !!mine)
      const likeBtn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('いいね')))
      if (likeBtn) {
        const sumLikes = async () => (await (await fetch(base + '/api/posts')).json()).items.reduce((s, p) => s + p.likes, 0)
        const before = await sumLikes()
        likeBtn.click()
        let ok = false
        for (let i = 0; i < 25 && !ok; i++) {
          await new Promise((r) => setTimeout(r, 200))
          ok = (await sumLikes()) > before
        }
        check('sns: like increments (server-side)', ok)
      }
    }
  }
  check('sns: no runtime errors', errors.length === 0, errors.slice(0, 2).join('|'))
  dom.window.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
