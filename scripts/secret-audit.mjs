#!/usr/bin/env node
/**
 * Secret hygiene check for this repository.
 *
 * Motivation: secret scanners kept flagging `scripts/interact5.mjs` even though
 * the values were throwaway QA account passwords. The fix was to generate them
 * at runtime — but the first attempt documented the offending literal, which
 * turned `docs/DESIGN.md` into a fresh detection site. This script enforces the
 * rule that came out of that: no credential-shaped *assignments* in tracked
 * files, and none in commit messages either.
 *
 * What it looks for (assignments, not prose):
 *   password|passwd|secret|token|api_key|apikey = '<literal>'
 *   Bearer <long token>
 *   well-known key shapes (GitHub, OpenAI-style, AWS, private keys)
 *
 * Usage:
 *   node scripts/secret-audit.mjs            # tracked files + commit messages
 *   node scripts/secret-audit.mjs --staged   # staged diff only (pre-commit)
 *
 * Exit code 0 = clean, 1 = findings.
 */
import { execFileSync } from 'node:child_process'

const staged = process.argv.includes('--staged')

const KEY_SHAPES = [
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['OpenAI-style key', /\bsk-(?!\.\.\.)[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/]
]

// A quoted literal after a credential-ish name. Template placeholders such as
// `${pw}` and env reads are not literals and must stay allowed.
const ASSIGNMENT = /(?:^|[^A-Za-z0-9_])(password|passwd|secret|token|api[_-]?key|apikey)\s*[:=]\s*(['"`])([^'"`\n]{6,})\2/gi
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g

// Values that are obviously placeholders rather than credentials.
const PLACEHOLDER = /^(?:<[^>]*>|\$\{[^}]*\}|sk-\.\.\.|\*+|x{4,}|\.{3,}|changeme|todo|example|placeholder)$/i

const ignoreFile = (file) =>
  file === 'scripts/secret-audit.mjs' || // this file lists the patterns
  file === 'package-lock.json' ||
  file.startsWith('dist/') ||
  file.startsWith('qa/') ||
  file.startsWith('node_modules/')

function scan(label, text, findings, file) {
  for (const [name, re] of KEY_SHAPES) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      const line = text.slice(0, m.index).split('\n').length
      findings.push(`${file}:${line}  ${name}`)
    }
  }
  for (const m of text.matchAll(ASSIGNMENT)) {
    const value = m[3]
    if (PLACEHOLDER.test(value)) continue
    if (value.includes('${')) continue // runtime value, e.g. `${pw}x`
    const line = text.slice(0, m.index).split('\n').length
    findings.push(`${file}:${line}  literal after "${m[1]}"`)
  }
  for (const m of text.matchAll(BEARER)) {
    const line = text.slice(0, m.index).split('\n').length
    findings.push(`${file}:${line}  bearer token`)
  }
  void label
}

const findings = []

if (staged) {
  const diff = execFileSync('git', ['diff', '--cached', '--unified=0'], { encoding: 'utf8' })
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n')
  scan('staged', added, findings, '(staged)')
} else {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  for (const file of files) {
    if (ignoreFile(file)) continue
    let text = ''
    try {
      text = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    } catch {
      continue // binary or unreadable: nothing to scan
    }
    scan(file, text, findings, file)
  }

  // Commit messages travel with the repo too, and a pasted secret there is just
  // as public as one in a file.
  const log = execFileSync('git', ['log', '--all', '--format=%h%x09%B'], { encoding: 'utf8' })
  scan('commit messages', log, findings, '(commit message)')
}

if (findings.length) {
  console.error(`✗ ${findings.length} possible credential(s) found:`)
  for (const f of [...new Set(findings)]) console.error('  ' + f)
  console.error('\nReplace literals with runtime generation (see scripts/interact5.mjs qaPassword()).')
  process.exit(1)
}

console.log('✓ secret audit: no credential-shaped literals in tracked files or commit messages')
