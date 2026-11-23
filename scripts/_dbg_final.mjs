import { JSDOM, VirtualConsole } from 'jsdom'
import { build } from 'esbuild'
import fs from 'node:fs'
const base='http://localhost:4173'
const entry=fs.readdirSync('dist/assets').find(f=>f.endsWith('.js')&&!f.includes('three'))
await build({entryPoints:[`dist/assets/${entry}`],bundle:true,format:'iife',outfile:'/tmp/pw_f.js',logLevel:'silent'})
const bundle=fs.readFileSync('/tmp/pw_f.js','utf8')
const vc=new VirtualConsole(); const errs=[]
vc.on('jsdomError',e=>errs.push(String(e.detail?.stack||e.detail||e.message||e)))
const html=await (await fetch(base+'/standings')).text()
const dom=new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/,''),{url:base+'/standings',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.fetch=(u,o)=>fetch(new URL(u,base).href,o);w.AbortController=AbortController;w.matchMedia=w.matchMedia||(q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));w.scrollTo=()=>{};w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}}}})
const s=dom.window.document.createElement('script'); s.textContent=bundle; dom.window.document.body.appendChild(s)
await new Promise(r=>setTimeout(r,9000))
console.log('errors:',errs.slice(0,2))
const txt=dom.window.document.body.textContent.replace(/\n+/g,' | ')
console.log(txt.slice(0,420))
