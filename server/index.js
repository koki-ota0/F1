import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import apiRouter from './api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 3000

const app = express()
app.use(express.json({ limit: '256kb' }))

app.use('/api', apiRouter)

if (fs.existsSync(DIST)) {
  // The static build marks itself API-less (`__PITWALL_API__=false`) so a Pages
  // deployment never polls in the background. When the same dist is served by
  // this Express app the API *is* there, so flip the flag at serve time —
  // otherwise the client would keep claiming "no server" on a server host.
  // Cached by mtime so `npm run build` takes effect without a restart (a stale
  // index would point at hashed assets the new build deleted).
  const INDEX = path.join(DIST, 'index.html')
  let cached = { at: -1, html: '' }
  const shell = () => {
    const at = fs.statSync(INDEX).mtimeMs
    if (at !== cached.at) {
      cached = {
        at,
        html: fs.readFileSync(INDEX, 'utf8').replace('__PITWALL_API__=false', '__PITWALL_API__=true')
      }
    }
    return cached.html
  }
  app.use(express.static(DIST, { index: false, maxAge: '1h' }))
  // let the client know it is running against our Express API (enables polling)
  app.get('*', (_req, res) => {
    try {
      res.type('html').send(shell())
    } catch {
      res.status(500).send('client build missing')
    }
  })
} else {
  app.get('/', (_req, res) => res.status(200).send('PITWALL API running. Build the client with `npm run build`.'))
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal error' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PITWALL server listening on http://0.0.0.0:${PORT}`)
})
