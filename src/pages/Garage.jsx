import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead, Loading } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'

/**
 * PITWALL GARAGE — interactive stylised F1 car.
 * A procedurally-built low-poly car rendered with Three.js (WebGL), coloured by
 * the selected team, with drag-to-rotate and zoom. Falls back to a static card
 * when WebGL is unavailable (e.g. very old browsers / jsdom QA).
 */
export default function Garage() {
  const { t, lang } = useLang()
  const { teams, myTeam } = useFan()
  const [teamId, setTeamId] = useState(myTeam?.id || teams[0]?.id || '')
  const [unsupported, setUnsupported] = useState(false)
  const mountRef = useRef(null)

  const team = teams.find((x) => x.id === teamId) || teams[0]
  const color = team?.color || '#E10600'

  useEffect(() => {
    if (!mountRef.current) return undefined
    let alive = true
    let cleanup = () => {}
    import('three').then((THREE) => {
      if (!alive || !mountRef.current) return
      try {
        cleanup = buildScene(THREE, mountRef.current, color)
      } catch {
        setUnsupported(true)
      }
    }).catch(() => alive && setUnsupported(true))
    return () => { alive = false; cleanup() }
  }, [color])

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <SectionHead eyebrow="PITWALL GARAGE" title={t('garage.title')} sub={t('garage.sub')} />

        <div className="card" style={{ marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" style={{ minWidth: 220 }} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {(teams || []).map((tm) => <option key={tm.id} value={tm.id}>{lang === 'ja' ? tm.nameJa : tm.name}</option>)}
          </select>
          <span className="note">{t('garage.hint')}</span>
        </div>

        <div
          ref={mountRef}
          className="garage-stage"
          style={{
            position: 'relative', height: 420, borderRadius: 14, overflow: 'hidden',
            background: 'radial-gradient(120% 120% at 50% 10%, #171b21 0%, #0a0c10 70%)',
            border: '1px solid var(--line)'
          }}
        >
          <div className="garage-badge">{lang === 'ja' ? (team?.nameJa || '') : (team?.name || '')}</div>
        </div>
        {unsupported && (
          <p className="note" style={{ marginTop: 12 }}>
            {t('garage.unsupported')} — <span className="num" style={{ fontSize: 22, color }}>■</span> {lang === 'ja' ? team?.nameJa : team?.name}
          </p>
        )}
      </div>
    </section>
  )
}

function buildScene(THREE, el, color) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.set(4.6, 2.6, 6.4)
  camera.lookAt(0, 0.4, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x14181f, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(5, 8, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8ec5ff, 0.8)
  rim.position.set(-6, 4, -5)
  scene.add(rim)

  const grid = new THREE.GridHelper(18, 36, 0x2a3140, 0x1a2030)
  grid.position.y = 0
  scene.add(grid)
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.9, metalness: 0.1 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  scene.add(floor)

  const car = buildCar(THREE, color)
  scene.add(car)

  // --- interaction: drag to rotate, buttons/slider to zoom
  let dragging = false
  let px = 0
  let py = 0
  let rotY = 0.6
  let rotX = 0.18
  let dist = 8.4
  const applyCamera = () => {
    camera.position.set(
      Math.sin(rotY) * Math.cos(rotX) * dist,
      0.6 + Math.sin(rotX) * dist,
      Math.cos(rotY) * Math.cos(rotX) * dist
    )
    camera.lookAt(0, 0.35, 0)
  }
  applyCamera()

  const down = (e) => { dragging = true; px = e.clientX; py = e.clientY }
  const move = (e) => {
    if (!dragging) return
    rotY += (e.clientX - px) * 0.01
    rotX = Math.max(-0.1, Math.min(1.2, rotX + (e.clientY - py) * 0.008))
    px = e.clientX; py = e.clientY
    applyCamera()
  }
  const up = () => { dragging = false }
  el.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)

  const onResize = () => {
    if (!el.clientWidth) return
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  }
  const ro = new ResizeObserver(onResize)
  ro.observe(el)

  let raf = 0
  const tick = () => {
    if (!dragging) { rotY += 0.004; applyCamera() }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()

  const zoomIn = () => { dist = Math.max(4.5, dist - 0.8); applyCamera() }
  const zoomOut = () => { dist = Math.min(14, dist + 0.8); applyCamera() }
  const zi = document.createElement('button')
  zi.className = 'btn sm garage-zoom'; zi.textContent = '+'; zi.addEventListener('click', zoomIn)
  const zo = document.createElement('button')
  zo.className = 'btn sm garage-zoom'; zo.textContent = '−'; zo.addEventListener('click', zoomOut)
  el.appendChild(zi); el.appendChild(zo)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    el.removeEventListener('pointerdown', down)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    zi.remove(); zo.remove()
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose())
    })
    renderer.dispose()
    if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
  }
}

/** Procedural low-poly Formula 1 car built from primitives. */
function buildCar(THREE, color) {
  const car = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.3, roughness: 0.55 })
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 })
  const rim = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.2 })

  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); car.add(mesh); return mesh }

  // floor + diffuser
  add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 4.6), dark), 0, 0.14, 0)
  // monocoque / survival cell
  add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 3.0), body), 0, 0.46, -0.3)
  // cockpit opening
  add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.9), dark), 0, 0.72, 0.15)
  // nose
  const nose = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.7), body), 0, 0.4, 1.75)
  nose.rotation.x = 0.06
  // front wing
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.55), dark), 0, 0.14, 2.45)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.5), body), -1.0, 0.28, 2.4)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.5), body), 1.0, 0.28, 2.4)
  // sidepods
  add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 1.5), body), -0.62, 0.42, -0.75)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 1.5), body), 0.62, 0.42, -0.75)
  // engine cover + shark fin
  add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.7), body), 0, 0.66, -1.15)
  const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 1.3)), body, 0, 0.85, -1.25)
  fin.rotation.x = -0.18
  // beam wing + rear wing
  add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.35), dark), 0, 0.8, -2.05)
  add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.4), dark), 0, 1.12, -2.15)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.75), body), -0.62, 1.0, -2.1)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.75), body), 0.62, 1.0, -2.1)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.1), dark), 0, 0.9, -2.05)
  // halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 10, 24, Math.PI), dark)
  halo.rotation.z = Math.PI
  halo.rotation.y = Math.PI / 2
  add(halo, 0, 0.86, 0.25)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.1), dark), 0, 0.8, 0.85)
  // mirrors + antenna
  add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), body), -0.5, 0.72, 0.55)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), body), 0.5, 0.72, 0.55)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark), 0, 1.0, -0.1)

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.42, 24)
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.44, 16)
  const positions = [
    [-0.95, 0.34, 1.5], [0.95, 0.34, 1.5],
    [-0.98, 0.34, -1.55], [0.98, 0.34, -1.55]
  ]
  for (const [x, y, z] of positions) {
    const w = new THREE.Mesh(wheelGeo, tyre)
    w.rotation.z = Math.PI / 2
    add(w, x, y, z)
    const r = new THREE.Mesh(rimGeo, rim)
    r.rotation.z = Math.PI / 2
    add(r, x, y, z)
  }
  return car
}
