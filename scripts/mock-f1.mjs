// Tiny Jolpica-shaped mock used only by QA (scripts/interact4.mjs).
//   node scripts/mock-f1.mjs [port]
import http from 'node:http'

const port = Number(process.argv[2]) || 4180
const races = [
  { round: 1, race_name: 'Mock Australian Grand Prix', date: '2026-03-06', circuit: { circuit_name: 'Albert Park' }, laps_total: 58 },
  { round: 2, race_name: 'Mock Japanese Grand Prix', date: '2026-03-27', circuit: { circuit_name: 'Suzuka' }, laps_total: 53 }
]
const drivers = [
  { driver_name: 'QA Racer', team_name: 'Mock Team', points: 99, wins: 1, position: 1 },
  { driver_name: 'Second Place', team_name: 'Other Team', points: 80, wins: 0, position: 2 }
]
const constructors = [
  { constructor_name: 'Mock Team', points: 120, wins: 1, position: 1 }
]

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const json = (body) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ results: body }))
  }
  if (url.pathname.endsWith('/races/')) return json(races)
  if (url.pathname.endsWith('/drivers/')) return json(drivers)
  if (url.pathname.endsWith('/constructors/')) return json(constructors)
  res.writeHead(404); res.end('{}')
}).listen(port, '0.0.0.0', () => console.log(`mock F1 API → http://0.0.0.0:${port}`))
