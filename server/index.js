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
  app.use(express.static(DIST, { index: false, maxAge: '1h' }))
  // let the client know it is running against our Express API (enables polling)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'), (err) => err && res.status(500).send('client build missing'))
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
