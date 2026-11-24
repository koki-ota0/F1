import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE || 'http://localhost:3000'
const distAssets = path.join(process.cwd(), 'dist', 'assets')
const entry = fs.readdirSync(distAssets).find((f) => f.endsWith('.js'))
if (!entry) { console.error('no built bundle found'); process.exit(1) }

const outfile = '/tmp/pitwall.classic.js'
await build({
  entryPoints: [path.join(distAssets, entry)],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  outfile,
  logLevel: 'silent'
})
const bundle = fs.readFileSync(outfile, 'utf8')

const routes = ['/', '/live', '/standings', '/calendar', '/drivers', '/drivers/verstappen', '/teams', '/teams/ferrari', '/predict', '/sim', '/quiz', '/login', '/news', '/social', '/fan', '/nope']

let failures = 0
for (const route of routes) {
  const errors = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e) => errors.push(String(e.detail || e.message || e)))
  vc.on('error', (m) => errors.push(String(m)))

  const html = await (await fetch(base + route)).text()
  const htmlNoModule = html.replace(/<script type="module"[^>]*><\/script>/, '')

  const dom = new JSDOM(htmlNoModule, {
    url: base + route,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (url, opts) => fetch(new URL(url, base).href, opts)
      window.AbortController = AbortController
      window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
      window.scrollTo = () => {}
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
      // The Express host injects this in index.html; the static build sets false.
      if (!('__PITWALL_API__' in window)) {
        const m = htmlNoModule.match(/__PITWALL_API__=(true|false)/)
        window.__PITWALL_API__ = m ? m[1] === 'true' : true
      }
    }
  })

  const s = dom.window.document.createElement('script')
  s.textContent = bundle
  dom.window.document.body.appendChild(s)

  await new Promise((r) => setTimeout(r, 3500))
  const root = dom.window.document.getElementById('root')
  const hasRoot = root && root.children.length > 0
  const text = (dom.window.document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 150)
  const ok = hasRoot && errors.length === 0
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${route} :: root=${hasRoot} errors=${errors.length}`)
  if (errors.length) console.log('    ', errors.slice(0, 4).join(' | ').slice(0, 400))
  else console.log('     text:', text)
  dom.window.close()
}
console.log(failures ? `\n${failures} route(s) failed` : '\nAll routes OK')
process.exit(failures ? 1 : 0)
