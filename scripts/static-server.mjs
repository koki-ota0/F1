#!/usr/bin/env node
// Minimal static-host simulator (GitHub Pages behaviour):
//   - serves dist/ files
//   - unknown paths → 404.html (SPA deep-link support)
//   - NO dynamic /api (only baked dist/api/*.json if present)
// Run: node scripts/static-server.mjs [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const PORT = Number(process.argv[2]) || 4173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(DIST, urlPath)
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end() }
  // GitHub Pages serves 404.html with an actual 404 status for unknown paths
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    return fs.createReadStream(path.join(DIST, '404.html')).pipe(res)
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, '0.0.0.0', () => {
  console.log(`PITWALL static-host simulator → http://0.0.0.0:${PORT}`)
})
