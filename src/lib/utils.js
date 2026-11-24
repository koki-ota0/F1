export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function fmtDate(iso, lang) {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric', weekday: 'short'
  }).format(d)
}

export function fmtGap(sec) {
  if (sec == null) return '—'
  if (sec === 0) return '—'
  const sign = sec > 0 ? '+' : ''
  return `${sign}${sec.toFixed(3)}`
}

export function nextRace(races) {
  if (!Array.isArray(races) || !races.length) return null
  const now = new Date()
  const sorted = [...races].sort((a, b) => new Date(a.date) - new Date(b.date))
  return sorted.find((r) => new Date(r.date + 'T23:59:59') >= now) || sorted[sorted.length - 1]
}

export function lastRace(races) {
  if (!Array.isArray(races) || !races.length) return null
  const now = new Date()
  const sorted = [...races].sort((a, b) => new Date(a.date) - new Date(b.date))
  return [...sorted].reverse().find((r) => new Date(r.date + 'T23:59:59') < now) || null
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useStateSafe(new Date())
  useEffectSafe(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// small wrappers to keep utils independent of React import cycles
import { useState as useStateSafe, useEffect as useEffectSafe } from 'react'

export function countdownParts(target, now) {
  let diff = Math.max(0, new Date(target).getTime() - new Date(now).getTime())
  const days = Math.floor(diff / 86400000)
  diff -= days * 86400000
  const hours = Math.floor(diff / 3600000)
  diff -= hours * 3600000
  const minutes = Math.floor(diff / 60000)
  diff -= minutes * 60000
  const seconds = Math.floor(diff / 1000)
  return { days, hours, minutes, seconds }
}

export function teamById(teams, id) {
  return teams.find((t) => t.id === id) || null
}

export function driverById(drivers, id) {
  return drivers.find((d) => d.id === id) || null
}

export function teamColor(teams, id) {
  return teamById(teams, id)?.color || '#e10600'
}

export function computeScore(pred, result) {
  if (!pred || !result) return 0
  const byPos = Object.fromEntries(result.map((r) => [r.position, r.driverId]))
  let pts = 0
  if (pred.p1 && byPos[1] === pred.p1) pts += 10
  if (pred.p2 && byPos[2] === pred.p2) pts += 7
  if (pred.p3 && byPos[3] === pred.p3) pts += 5
  if (pred.fl) {
    const fl = result.find((r) => r.position <= 10 && r.driverId === pred.fl)
    if (fl) pts += 5
  }
  if (pred.p1 && pred.p2 && pred.p3 && [1, 2, 3].every((p) => byPos[p] === pred[`p${p}`])) pts += 5
  return pts
}

/**
 * Display label for a result/standings driver.
 *
 * Data tiers are inconsistent: bundled snapshots carry `{number, name, nameJa}`,
 * live rows sometimes only have a number, and the archive uses plain strings.
 * Always resolve to a person's name — a bare number is never an acceptable
 * answer on a fan-facing page.
 */
export function driverName(entry, lang = 'ja', byNumber = null) {
  if (entry == null || entry === '') return ''
  if (typeof entry === 'string') return entry
  const direct = lang === 'ja' ? (entry.nameJa || entry.name) : entry.name
  if (direct) return direct
  if (byNumber && entry.number != null) {
    const hit = byNumber.get(String(entry.number))
    if (hit) return lang === 'ja' ? (hit.nameJa || hit.name) : hit.name
  }
  // last resort: make the number explicit rather than silently meaningless
  return entry.number != null ? `#${entry.number}` : ''
}

/** Winner block of a round: name + team, resolved the same way as everywhere else. */
export function winnerLabel(round, lang = 'ja', byNumber = null) {
  const w = round?.winner
  if (!w) return { name: '', team: round?.winnerTeam || '' }
  if (typeof w === 'string') return { name: w, team: round?.winnerTeam || '' }
  return { name: driverName(w, lang, byNumber), team: w.team || '' }
}
