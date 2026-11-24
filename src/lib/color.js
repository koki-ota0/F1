/**
 * Colour helpers shared by the theme override (FanProvider) and the cards.
 *
 * A favourite team recolours the whole site via CSS custom properties, so the
 * accent used for *text* must be checked against the dark background instead of
 * being copied verbatim — McLaren orange, Ferrari red and the like all fail
 * WCAG AA on #07080d when used as small uppercase labels.
 */

// hex is stored WITHOUT the leading '#', so channels are at [0,2], [2,4], [4,6]
const chan = (hex, i) => parseInt(hex.slice(i, i + 2), 16) / 255

function relLum(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return null
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * f(chan(h, 0)) + 0.7152 * f(chan(h, 2)) + 0.0722 * f(chan(h, 4))
}

export function contrast(a, b) {
  const x = relLum(a)
  const y = relLum(b)
  if (x == null || y == null) return 1
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const mix = (hex, target, t) => {
  const a = [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16))
  const b = [0, 2, 4].map((i) => parseInt(target.slice(i + 1, i + 3), 16))
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * Accent colour that stays >= 4.5:1 on the dark page background.
 * Keeps the team hue: brightens toward white first, then (for very light
 * liveries) darkens toward near-black.
 */
export function readableAccentOnDark(hex, minRatio = 4.5) {
  const base = String(hex || '').replace('#', '')
  const candidate = '#' + (base.length >= 6 ? base : 'e10600')
  if (contrast(candidate, '#07080d') >= minRatio) return candidate
  for (let t = 0.1; t <= 0.95; t += 0.05) {
    const lighter = mix(candidate, '#ffffff', t)
    if (contrast(lighter, '#07080d') >= minRatio) return lighter
  }
  for (let t = 0.1; t <= 0.95; t += 0.05) {
    const darker = mix(candidate, '#0b0d11', t)
    if (contrast(darker, '#07080d') >= minRatio) return darker
  }
  return '#ff4d4d'
}

/** Best pure ink for a filled colour, and the contrast it achieves. */
function bestInk(hex, minRatio = 4.5) {
  const darkInk = '#0b0d11'
  const whiteInk = '#ffffff'
  const onDark = contrast(darkInk, hex)
  const onWhite = contrast(whiteInk, hex)
  const ink = onWhite >= onDark ? whiteInk : darkInk
  return { ink, ratio: Math.max(onDark, onWhite), target: ink === whiteInk ? '#0b0d11' : '#ffffff' }
}

/**
 * Badge palette: a fill derived from the team colour plus an ink that keeps at
 * least 4.5:1 on it. If the pure team colour cannot host either pure ink, the
 * fill is shifted slightly along its own hue (never desaturated) until it can.
 */
export function badgePalette(hex, minRatio = 4.5) {
  const base = String(hex || '').replace('#', '')
  const candidate = '#' + (base.length >= 6 ? base : 'e10600')
  const { ink, ratio, target } = bestInk(candidate, minRatio)
  if (ratio >= minRatio) return { bg: candidate, ink }
  for (let t = 0.03; t <= 0.5; t += 0.03) {
    const moved = mix(candidate, target, t)
    if (contrast(ink, moved) >= minRatio) return { bg: moved, ink }
  }
  return { bg: candidate, ink }
}

/** Ink (near-black or white) that reads best on a filled team colour. */
export function inkOn(hex) {
  return bestInk(String(hex || '').length >= 6 ? String(hex) : '#e10600').ink
}
