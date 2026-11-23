// PITWALL race simulation engine.
// Deterministic-ish: pace = driver rating + team strength + per-lap noise, with small incident/DNF odds.

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

function teamBonus(teamInfo) {
  if (!teamInfo) return 0
  // map team strength loosely by known 2025 hierarchy
  const table = {
    'red-bull': 4, 'mclaren': 4, 'ferrari': 3, 'mercedes': 3,
    'williams': 1, 'racing-bulls': 0, 'alpine': -1, 'aston-martin': -1,
    'haas': -2, 'sauber': -3
  }
  return table[teamInfo.id] ?? 0
}

function basePace(driver, teamInfo) {
  // lower = faster. rating 75-97 -> ~0.9s spread, plus team.
  return 90 - (driver.rating - 75) * 0.085 - teamBonus(teamInfo)
}

function makeRunner(driver, teams) {
  const teamInfo = teams.find((t) => t.id === driver.team) || null
  const base = basePace(driver, teamInfo)
  const dnf = Math.random() < 0.018 // ~2% per race
  const incident = Math.random() < 0.05
  return {
    driver,
    teamInfo,
    base,
    dnfLap: dnf ? 5 + Math.floor(Math.random() * (incident ? 30 : 50)) : null,
    incidentLap: incident ? 10 + Math.floor(Math.random() * 40) : null,
    time: 0,
    lap: 0,
    status: 'RUNNING',
    gap: 0
  }
}

function lapTime(r, lapIdx) {
  // tyre degradation curve + traffic noise
  const deg = Math.sin((lapIdx / 60) * Math.PI) * 0.45
  const noise = (Math.random() - 0.5) * 0.7
  const traffic = Math.random() < 0.06 ? 0.8 + Math.random() * 1.6 : 0
  return r.base + deg + noise + traffic
}

/** Simulate one race; returns { laps, snapshots, result } where snapshots[l] = ordered driver ids. */
export function simulateRace(drivers, teams, laps = 52) {
  const runners = drivers.map((d) => makeRunner(d, teams))
  const snapshots = []
  for (let lap = 1; lap <= laps; lap++) {
    for (const r of runners) {
      if (r.status === 'DNF') continue
      if (r.dnfLap === lap) { r.status = 'DNF'; r.lap = lap; continue }
      let t = lapTime(r, lap)
      if (r.incidentLap === lap) t += 6 + Math.random() * 10
      if (lap === 1 && r.lap === 0) t += (Math.random() - 0.5) * 2 // start chaos
      r.time += t
      r.lap = lap
    }
    const order = [...runners].sort((a, b) => {
      if (a.status === 'DNF' && b.status === 'DNF') return a.lap - b.lap
      if (a.status === 'DNF') return 1
      if (b.status === 'DNF') return -1
      return a.time - b.time
    })
    snapshots.push(order.map((r) => r.driver.id))
  }
  const finalOrder = snapshots[snapshots.length - 1]
  const winnerTime = runners.find((r) => r.driver.id === finalOrder[0]).time
  const result = finalOrder.map((id, idx) => {
    const r = runners.find((x) => x.driver.id === id)
    return {
      driverId: id,
      position: idx + 1,
      points: r.status === 'DNF' ? 0 : (POINTS[idx] ?? 0),
      status: r.status,
      gap: r.status === 'DNF' ? null : r.time - winnerTime,
      laps: r.lap
    }
  })
  // fastest lap among classified
  const classified = result.filter((x) => x.status !== 'DNF')
  const flHolder = classified[Math.floor(Math.random() * Math.min(6, classified.length))]
  if (flHolder && flHolder.position <= 10) flHolder.points += 1
  return { laps, snapshots, result }
}

/** Full season: simulate every race, accumulate points. */
export function simulateSeason(drivers, teams, calendar) {
  const driverPts = Object.fromEntries(drivers.map((d) => [d.id, 0]))
  const teamPts = {}
  for (const race of calendar) {
    const laps = race.laps || 52
    const { result } = simulateRace(drivers, teams, laps)
    for (const row of result) {
      driverPts[row.driverId] = (driverPts[row.driverId] || 0) + row.points
      const d = drivers.find((x) => x.id === row.driverId)
      if (d) teamPts[d.team] = (teamPts[d.team] || 0) + row.points
    }
  }
  const driversStandings = drivers
    .map((d) => ({ driver: d, points: driverPts[d.id] || 0 }))
    .sort((a, b) => b.points - a.points)
    .map((x, i) => ({ ...x, position: i + 1 }))
  const constructors = Object.entries(teamPts)
    .map(([team, points]) => ({ team, points }))
    .sort((a, b) => b.points - a.points)
    .map((x, i) => ({ ...x, position: i + 1 }))
  return { drivers: driversStandings, constructors }
}
