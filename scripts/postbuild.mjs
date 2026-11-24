#!/usr/bin/env node
// Post-build steps for static hosting (GitHub Pages etc.)
//   1. dist/404.html  → SPA deep-link support (Pages serves 404.html on unknown paths)
//   2. dist/api/*.json → baked snapshots so even non-/api-aware hosts answer basic GETs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// 1) 404.html = index.html
fs.copyFileSync(path.join(DIST, 'index.html'), path.join(DIST, '404.html'))

// 2) /api static snapshots
const SRC = path.join(__dirname, '..', 'server', 'data')
const files = ['drivers.json', 'teams.json', 'calendar.json', 'champions.json', 'records.json', 'trivia.json', 'news.json', 'season.json', 'results-2025.json', 'standings-2025.json', 'posts.json']
fs.mkdirSync(path.join(DIST, 'api'), { recursive: true })
for (const f of files) {
  const name = f.replace(/\.json$/, '')
  fs.copyFileSync(path.join(SRC, f), path.join(DIST, 'api', name))
}
fs.writeFileSync(
  path.join(DIST, 'api', 'meta'),
  JSON.stringify({ app: 'PITWALL', mode: 'static-host', note: 'GitHub Pages等、サーバレス環境用の焼き込みデータ' }, null, 2)
)

// 3) mark the client build so pages know there is no Express API behind it
//    (static hosts must stay strictly on-demand — no interval polling).
const INDEX = path.join(DIST, 'index.html')
let html = fs.readFileSync(INDEX, 'utf8')
if (html.includes('__PITWALL_API__=true')) {
  html = html.replace('__PITWALL_API__=true', '__PITWALL_API__=false')
  fs.writeFileSync(INDEX, html)
  fs.copyFileSync(INDEX, path.join(DIST, '404.html'))
}
fs.writeFileSync(path.join(DIST, 'api', 'predictions'), JSON.stringify({ leaderboard: [] }, null, 2))
console.log('[postbuild] 404.html + dist/api/*.json written')
