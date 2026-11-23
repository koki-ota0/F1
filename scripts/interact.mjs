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
  const htmlNoModule = html.replace(/<script type="module"[^>]*><\/script>/, '')
  const dom = new JSDOM(htmlNoModule, {
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
  const waitFor = async (fn, timeout = 12000) => {
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
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`)
}

// --- Quiz flow ---
{
  const { dom, waitFor, doc, errors } = await open('/quiz')
  const startBtn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('すべて')))
  check('quiz: category buttons rendered', !!startBtn)
  if (startBtn) {
    startBtn.click()
    const opt = await waitFor(() => doc.querySelector('.quiz-opt'))
    check('quiz: question rendered', !!opt)
    if (opt) {
      opt.click()
      const verdict = await waitFor(() => doc.body.textContent.match(/正解|不正解/))
      check('quiz: verdict shown', !!verdict, verdict ? `(${verdict[0]})` : '')
      const nextBtn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => /次へ|結果を見る/.test(b.textContent)))
      check('quiz: next button shown', !!nextBtn)
      if (nextBtn) {
        nextBtn.click()
        await new Promise((r) => setTimeout(r, 600))
        const progress = doc.body.textContent.match(/問 2\/5|結果発表/)
        check('quiz: advanced to Q2 or results', !!progress, progress ? progress[0] : '')
      }
    }
  }
  check('quiz: no runtime errors', errors.length === 0, errors.slice(0, 2).join('|'))
  dom.window.close()
}

// --- Fan flow ---
{
  const { dom, waitFor, doc, errors, win } = await open('/fan')
  const driverSel = await waitFor(() => doc.querySelectorAll('select.input')[0])
  const teamSel = await waitFor(() => doc.querySelectorAll('select.input')[1])
  const nameInput = await waitFor(() => doc.querySelector('input.input'))
  check('fan: form rendered', !!driverSel && !!teamSel && !!nameInput)
  if (driverSel && teamSel && nameInput) {
    const setVal = (el, v) => { el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })) }
    const setInput = (el, v) => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
      el.dispatchEvent(new win.Event('input', { bubbles: true }))
    }
    setVal(driverSel, 'norris')
    setVal(teamSel, 'ferrari')
    setInput(nameInput, 'Taro')
    const saveBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    check('fan: save button found', !!saveBtn)
    if (saveBtn) {
      saveBtn.click()
      await new Promise((r) => setTimeout(r, 800))
      const stored = JSON.parse(win.localStorage.getItem('pitwall.fan') || '{}')
      check('fan: profile saved', stored.driver === 'norris' && stored.team === 'ferrari' && stored.name === 'Taro', JSON.stringify(stored))
      check('fan: accent applied', doc.documentElement.style.getPropertyValue('--accent')?.includes('E8002D') || doc.documentElement.style.getPropertyValue('--accent') !== '', `accent=${doc.documentElement.style.getPropertyValue('--accent')}`)
    }
  }
  check('fan: no runtime errors', errors.length === 0, errors.slice(0, 2).join('|'))
  dom.window.close()
}

// --- Predict flow ---
{
  const { dom, waitFor, doc, errors } = await open('/predict')
  const selects = await waitFor(() => doc.querySelectorAll('select.input').length >= 5 ? [...doc.querySelectorAll('select.input')] : null)
  check('predict: form rendered', !!selects && selects.length >= 5, selects ? `${selects.length} selects` : 'none')
  if (selects) {
    const win = dom.window
    const setVal = (el, v) => { el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })) }
    const opts = (el) => [...el.options].map((o) => o.value).filter(Boolean)
    const [raceSel, p1Sel, p2Sel, p3Sel, flSel] = selects
    const vals = opts(p1Sel)
    if (vals.length >= 3) {
      setVal(p1Sel, vals[0]); setVal(p2Sel, vals[1]); setVal(p3Sel, vals[2]); setVal(flSel, vals[0])
      const submit = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('予測を送信'))
      check('predict: submit enabled', !!submit && !submit.disabled)
      if (submit && !submit.disabled) {
        submit.click()
        const saved = await waitFor(() => doc.body.textContent.includes('保存しました') || doc.body.textContent.match(/Rd\.\d+/))
        check('predict: prediction saved', !!saved)
        const scoreBtn = await waitFor(() => [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('獲得ポイント')))
        check('predict: score button present', !!scoreBtn)
        if (scoreBtn) {
          scoreBtn.click()
          const pts = await waitFor(() => doc.body.textContent.match(/\d+ pts/))
          check('predict: scored against sim', !!pts, pts ? pts[0] : '')
        }
      }
    }
  }
  check('predict: no runtime errors', errors.length === 0, errors.slice(0, 2).join('|'))
  dom.window.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
