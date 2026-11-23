#!/usr/bin/env node
// Copy the canonical dataset (server/data) into the client bundle so the SPA
// works standalone on any static host (GitHub Pages, Netlify, ...) without the
// Express /api backend. Server stays the single source of truth.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'server', 'data')
const DEST = path.join(ROOT, 'src', 'lib', 'static')

const FILES = ['drivers.json', 'teams.json', 'calendar.json', 'champions.json', 'records.json', 'trivia.json', 'news.json', 'season.json']

fs.mkdirSync(DEST, { recursive: true })
for (const f of FILES) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f))
}
console.log(`[sync-bundle] ${FILES.length} datasets → src/lib/static`)
