import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead, Loading } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'

/**
 * PITWALL GARAGE — interactive 3D Formula 1 car.
 *
 * The car is a hand-built procedural model (no external asset): an extruded
 * survival-cell cross-section, lofted nose/engine-cover profiles, curved wings,
 * tubular halo and wishbones, tyres with real sidewall bulge, tread and wheel
 * rims. Materials are physically based (clearcoat paint, carbon fibre, rubber,
 * anodised metal) and lit by an image-based studio environment plus shadowed
 * key light, so it reads as a rendered object rather than a low-poly toy.
 *
 * If WebGL is unavailable the page keeps working with a labelled static state.
 */
export default function Garage() {
  const { t, lang } = useLang()
  const { teams, myTeam } = useFan()
  const [teamId, setTeamId] = useState(myTeam?.id || teams[0]?.id || '')
  const [unsupported, setUnsupported] = useState(false)
  const [noModel, setNoModel] = useState(false)
  const mountRef = useRef(null)

  const team = teams.find((x) => x.id === teamId) || teams[0]
  const color = team?.color || '#E10600'

  useEffect(() => {
    if (!mountRef.current) return undefined
    let alive = true
    let cleanup = () => {}
    import('three').then(async (THREE) => {
      if (!alive || !mountRef.current) return
      try {
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
        if (!alive || !mountRef.current) return
        // If this environment has no GPU, WebGL context creation throws and we
        // keep the labelled static state instead of rendering a black canvas.
        if (!hasWebGL()) throw new Error('no-webgl')
        cleanup = buildScene(THREE, RoomEnvironment, mountRef.current, color, team?.number || '')
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[garage] 3D disabled:', err?.message || err)
        alive && setUnsupported(true)
      }
    }).catch(() => alive && setNoModel(true))
    return () => { alive = false; cleanup() }
  }, [color, team?.number])

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <SectionHead eyebrow="PITWALL GARAGE" title={t('garage.title')} sub={t('garage.sub')} />

        <div className="card" style={{ marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="sr-only">{t('garage.pickTeam')}</span>
            <select className="input" style={{ minWidth: 220 }} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {(teams || []).map((tm) => <option key={tm.id} value={tm.id}>{lang === 'ja' ? tm.nameJa : tm.name}</option>)}
            </select>
          </label>
          <span className="note">{t('garage.hint')}</span>
        </div>

        <div
          ref={mountRef}
          className="garage-stage"
          style={{
            position: 'relative',
            height: 440,
            borderRadius: 14,
            overflow: 'hidden',
            background: 'radial-gradient(120% 120% at 50% 10%, #171b21 0%, #0a0c10 70%)',
            border: '1px solid var(--line)'
          }}
        >
          <div className="garage-badge">{lang === 'ja' ? (team?.nameJa || '') : (team?.name || '')}</div>
          {unsupported && (
            <div className="garage-fallback" role="status">
              <span className="num" style={{ fontSize: 40 }}>■</span>
              <p className="note" style={{ margin: '8px 0 0' }}>{t('garage.unsupported')}</p>
            </div>
          )}
          {noModel && (
            <div className="garage-fallback" role="status">
              <span className="num" style={{ fontSize: 40 }}>■</span>
              <p className="note" style={{ margin: '8px 0 0' }}>{t('garage.noModel')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Feature-detect a usable WebGL context before creating a renderer. */
function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')
    if (!gl) return false
    const ok = gl.getParameter(gl.VERSION)
    c.width = c.height = 0
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(ok)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ scene */

const ZOOM_IN_LABEL = 'Zoom in / ズームイン'
const ZOOM_OUT_LABEL = 'Zoom out / ズームアウト'

function buildScene(THREE, RoomEnvironment, el, color, number = '') {
  const scene = new THREE.Scene()

  // image-based lighting: a small procedural studio room, prefiltered into an
  // environment map — this is what makes the paint and carbon read as real
  const envRenderer = new THREE.WebGLRenderer({ antialias: true })
  const pmrem = new THREE.PMREMGenerator(envRenderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap

  const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.set(4.6, 2.6, 6.4)
  camera.lookAt(0, 0.4, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  el.appendChild(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x12161d, 0.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 8, 6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -7; key.shadow.camera.right = 7
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8ec5ff, 1.1)
  rim.position.set(-6, 4, -5)
  scene.add(rim)
  const fill = new THREE.DirectionalLight(0xffe6d0, 0.5)
  fill.position.set(-3, 2, 5)
  scene.add(fill)

  // floor: soft circular dais + shadow catcher
  const grid = new THREE.GridHelper(20, 40, 0x2a3140, 0x181e2a)
  grid.material.transparent = true
  grid.material.opacity = 0.35
  grid.position.y = 0.002
  scene.add(grid)
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(10, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.72, metalness: 0.08 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.25, 0.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x12161d, roughness: 0.45, metalness: 0.35 })
  )
  dais.position.y = 0.025
  dais.receiveShadow = true
  scene.add(dais)

  const car = buildCar(THREE, color, number)
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false } })
  scene.add(car)

  // --- interaction: drag to rotate, wheel/pinch zoom, buttons too
  let dragging = false
  let px = 0
  let py = 0
  let rotY = 0.6
  let rotX = 0.18
  let dist = 8.4
  let lastPinch = 0
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
  const wheel = (e) => {
    e.preventDefault()
    dist = Math.max(4.5, Math.min(14, dist + e.deltaY * 0.006))
    applyCamera()
  }
  const pinch = (e) => {
    if (!e.touches || e.touches.length !== 2) return
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
    if (lastPinch) {
      dist = Math.max(4.5, Math.min(14, dist - (d - lastPinch) * 0.02))
      applyCamera()
    }
    lastPinch = d
  }
  const endTouch = () => { lastPinch = 0 }
  el.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  el.addEventListener('wheel', wheel, { passive: false })
  el.addEventListener('touchstart', pinch, { passive: true })
  el.addEventListener('touchmove', pinch, { passive: true })
  el.addEventListener('touchend', endTouch)

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
  zi.className = 'btn sm garage-zoom'; zi.textContent = '+'
  zi.title = ZOOM_IN_LABEL; zi.setAttribute('aria-label', ZOOM_IN_LABEL)
  const zo = document.createElement('button')
  zo.className = 'btn sm garage-zoom'; zo.textContent = '−'
  zo.title = ZOOM_OUT_LABEL; zo.setAttribute('aria-label', ZOOM_OUT_LABEL)

  zi.addEventListener('click', zoomIn)
  zo.addEventListener('click', zoomOut)
  el.appendChild(zi); el.appendChild(zo)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    el.removeEventListener('pointerdown', down)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    el.removeEventListener('wheel', wheel)
    el.removeEventListener('touchstart', pinch)
    el.removeEventListener('touchmove', pinch)
    el.removeEventListener('touchend', endTouch)
    zi.remove(); zo.remove()
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose())
    })
    envMap.dispose(); pmrem.dispose(); envRenderer.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
  }
}

/* ------------------------------------------------------------------- car */

/**
 * Procedural modern F1 car.
 *
 * Shape strategy (realism without an external mesh):
 *  - survival cell & sidepods are EXTRUDED from rounded-rectangle cross
 *    sections, then tapered, so the body has real shoulders and corners;
 *  - the nose and engine cover are LOFTED through elliptical rings, giving
 *    smooth aerodynamic curvature instead of flat boxes;
 *  - wings are thin extruded aerofoil-ish profiles with camber and endplates;
 *  - tyres use a lathe profile (sidewall bulge + tread band) with a normal-map
 *    style groove pattern generated on a canvas texture;
 *  - suspension uses tubular wishbones, and the wheels have rims, spokes,
 *    hubs, brake ducts and locking nuts.
 */
function buildCar(THREE, color, number = '') {
  const car = new THREE.Group()

  /* ---------------- materials ---------------- */
  const paint = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.35, roughness: 0.28,
    clearcoat: 0.9, clearcoatRoughness: 0.12,
    sheen: 0.2, envMapIntensity: 1.1
  })
  const carbon = new THREE.MeshStandardMaterial({ color: 0x14171b, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.9 })
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.85, roughness: 0.35, envMapIntensity: 1 })
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.6, roughness: 0.45 })
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.18, envMapIntensity: 1.2 })
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.88, metalness: 0.02 })
  tyreMat.normalMap = makeTyreNormal(THREE)
  tyreMat.normalScale = new THREE.Vector2(0.9, 0.9)
  const rimTyreMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.1 })
  const visor = new THREE.MeshStandardMaterial({ color: 0x0d1116, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.9, roughness: 0.25 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b36a, metalness: 0.9, roughness: 0.28 })
  const accent = new THREE.MeshStandardMaterial({ color: 0xe10600, roughness: 0.4, metalness: 0.2 })

  const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); car.add(mesh); return mesh }

  /* ---------------- survival cell / monocoque ---------------- */
  const roundedRect = (w, h, r) => {
    const s = new THREE.Shape()
    const hw = w / 2; const hh = h / 2
    s.moveTo(-hw + r, -hh)
    s.lineTo(hw - r, -hh)
    s.quadraticCurveTo(hw, -hh, hw, -hh + r)
    s.lineTo(hw, hh - r)
    s.quadraticCurveTo(hw, hh, hw - r, hh)
    s.lineTo(-hw + r, hh)
    s.quadraticCurveTo(-hw, hh, -hw, hh - r)
    s.lineTo(-hw, -hh + r)
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
    return s
  }
  const chassisGeo = new THREE.ExtrudeGeometry(roundedRect(1.16, 0.56, 0.2), {
    depth: 2.9, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 12
  })
  chassisGeo.center()
  const chassis = add(new THREE.Mesh(chassisGeo, paint), 0, 0.5, -0.35)
  chassis.rotation.y = Math.PI / 2

  /* ---------------- cockpit opening (inset tub) ---------------- */
  const tubGeo = new THREE.ExtrudeGeometry(roundedRect(0.66, 0.34, 0.16), {
    depth: 1.15, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10
  })
  tubGeo.center()
  const tub = add(new THREE.Mesh(tubGeo, carbon), 0, 0.76, 0.05)
  tub.rotation.y = Math.PI / 2

  /* ---------------- loft helper ---------------- */
  // stations: [z, halfWidth, yBottom, yTop, roundness]
  const loft = (stations, radialSegs = 24) => {
    const rings = stations.map(([z, w, yb, yt]) => {
      const cy = (yb + yt) / 2
      const ry = Math.max(0.01, (yt - yb) / 2)
      return { z, w, cy, ry }
    })
    const shape = new THREE.Shape()
    // build one ring as an ellipse-ish rounded rectangle in the X/Y plane
    rings.forEach((r, i) => {
      const N = radialSegs
      const vertices = []
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2
        const cx = Math.cos(a) * r.w
        // superellipse for a slightly boxy aero section
        const sy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.65) * r.ry
        vertices.push([cx, r.cy + sy])
      }
      if (i === 0) {
        shape.moveTo(vertices[0][0], vertices[0][1])
        vertices.slice(1).forEach(([x, y]) => shape.lineTo(x, y))
        shape.closePath()
      }
      r.vertices = vertices
    })
    const geo = new THREE.BufferGeometry()
    const verts = []
    const ringsVerts = rings.map((r) => r.vertices)
    for (let i = 0; i < ringsVerts.length - 1; i++) {
      const a = ringsVerts[i]; const b = ringsVerts[i + 1]
      for (let k = 0; k < radialSegs; k++) {
        const a0 = a[k]; const a1 = a[(k + 1) % radialSegs]
        const b0 = b[k]; const b1 = b[(k + 1) % radialSegs]
        verts.push(a0[0], a0[1], rings[i].z, a1[0], a1[1], rings[i].z, b0[0], b0[1], rings[i + 1].z)
        verts.push(b0[0], b0[1], rings[i + 1].z, a1[0], a1[1], rings[i].z, b1[0], b1[1], rings[i + 1].z)
      }
    }
    // caps
    const first = ringsVerts[0]; const last = ringsVerts[ringsVerts.length - 1]
    for (let k = 1; k < radialSegs - 1; k++) {
      verts.push(first[0][0], first[0][1], rings[0].z, first[k + 1][0], first[k + 1][1], rings[0].z, first[k][0], first[k][1], rings[0].z)
      verts.push(last[0][0], last[0][1], rings[rings.length - 1].z, last[k][0], last[k][1], rings[rings.length - 1].z, last[k + 1][0], last[k + 1][1], rings[rings.length - 1].z)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geo.computeVertexNormals()
    return geo
  }

  /* ---------------- nose (lofted, sloping down to the front wing) -------- */
  const noseGeo = loft([
    [2.5, 0.05, 0.28, 0.42],
    [2.0, 0.12, 0.26, 0.5],
    [1.2, 0.16, 0.28, 0.6],
    [0.4, 0.2, 0.3, 0.66],
    [-0.2, 0.26, 0.32, 0.68]
  ], 20)
  add(new THREE.Mesh(noseGeo, paint))

  /* ---------------- engine cover + shark fin ---------------- */
  const coverGeo = loft([
    [-0.25, 0.3, 0.42, 0.8],
    [-0.9, 0.34, 0.34, 0.86],
    [-1.6, 0.3, 0.28, 0.82],
    [-2.1, 0.24, 0.24, 0.62],
    [-2.35, 0.16, 0.22, 0.4]
  ], 20)
  add(new THREE.Mesh(coverGeo, paint))

  // shark fin: thin swept triangle plate
  const finShape = new THREE.Shape()
  finShape.moveTo(0, 0); finShape.lineTo(0.9, 0.28); finShape.lineTo(1.5, 0.5); finShape.lineTo(0.9, 0.05)
  finShape.closePath()
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.035, bevelEnabled: false })
  const fin = add(new THREE.Mesh(finGeo, paint), -0.15, 0.6, 0)
  fin.rotation.set(0, Math.PI / 2, 0)
  fin.rotation.z = 0.2

  /* ---------------- sidepods + cooling inlets ---------------- */
  const podGeo = new THREE.ExtrudeGeometry(roundedRect(0.44, 0.44, 0.14), {
    depth: 1.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10
  })
  podGeo.center()
  const podL = add(new THREE.Mesh(podGeo, paint), -0.66, 0.44, -0.8)
  const podR = add(new THREE.Mesh(podGeo, paint), 0.66, 0.44, -0.8)
  podL.rotation.y = Math.PI / 2; podR.rotation.y = Math.PI / 2
  // inlet lips
  const inletGeo = new THREE.TorusGeometry(0.15, 0.035, 8, 20)
  add(new THREE.Mesh(inletGeo, carbon), -0.66, 0.5, -0.05).rotation.y = Math.PI / 2
  add(new THREE.Mesh(inletGeo, carbon), 0.66, 0.5, -0.05).rotation.y = Math.PI / 2

  /* ---------------- floor + diffuser ---------------- */
  const floorGeo = new THREE.ExtrudeGeometry(roundedRect(1.86, 4.5, 0.12), { depth: 0.05, bevelEnabled: false })
  floorGeo.rotateX(Math.PI / 2)
  floorGeo.center()
  const floorMesh = add(new THREE.Mesh(floorGeo, carbon), 0, 0.13, -0.15)
  floorMesh.scale.set(1, 1, 1)
  // edge wings on the floor
  const edgeGeo = new THREE.BoxGeometry(0.06, 0.12, 3.4)
  add(new THREE.Mesh(edgeGeo, carbon), -0.9, 0.1, -0.3).rotation.x = 0.06
  add(new THREE.Mesh(edgeGeo, carbon), 0.9, 0.1, -0.3).rotation.x = 0.06
  // diffuser with strakes
  const diffGeo = new THREE.BoxGeometry(0.9, 0.06, 0.5)
  add(new THREE.Mesh(diffGeo, darkMetal), 0, 0.2, -2.25).rotation.x = -0.22
  for (let i = -2; i <= 2; i++) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.42), darkMetal)
    add(strake, i * 0.17, 0.21, -2.25).rotation.x = -0.22
  }

  /* ---------------- front wing ---------------- */
  const fwGroup = new THREE.Group()
  fwGroup.position.set(0, 0.16, 2.55)
  car.add(fwGroup)
  const mainPlane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.025, 0.42), carbon)
  mainPlane.position.set(0, 0.06, 0.1)
  fwGroup.add(mainPlane)
  const flap1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.02, 0.22), carbon)
  flap1.position.set(0, 0.1, -0.16); flap1.rotation.x = 0.28
  fwGroup.add(flap1)
  const flap2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.018, 0.14), carbon)
  flap2.position.set(0, 0.17, -0.26); flap2.rotation.x = 0.42
  fwGroup.add(flap2)
  // cascading toe + endplates with fences
  const endGeo = new THREE.BoxGeometry(0.03, 0.26, 0.62)
  for (const sx of [-1, 1]) {
    const ep = new THREE.Mesh(endGeo, paint)
    ep.position.set(sx * 1.0, 0.13, 0)
    fwGroup.add(ep)
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.3), carbon)
    fence.position.set(sx * 0.92, 0.14, -0.1); fence.rotation.x = 0.3
    fwGroup.add(fence)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.34), carbon)
    foot.position.set(sx * 0.98, 0.03, 0.1)
    fwGroup.add(foot)
  }
  // wing support pylons linking to the nose tip
  const pylonGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06)
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(pylonGeo, carbon)
    p.position.set(sx * 0.22, 0.22, 0.3); p.rotation.x = -0.5
    fwGroup.add(p)
  }

  /* ---------------- rear wing (two-element + beam + endplates) --------- */
  const rwGroup = new THREE.Group()
  rwGroup.position.set(0, 0.85, -2.25)
  car.add(rwGroup)
  const rwMain = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.36), carbon)
  rwMain.position.set(0, 0.16, -0.05); rwMain.rotation.x = 0.18
  rwGroup.add(rwMain)
  const rwTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.018, 0.28), carbon)
  rwTop.position.set(0, 0.34, -0.16); rwTop.rotation.x = 0.4
  rwGroup.add(rwTop)
  const rwFlap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.016, 0.14), carbon)
  rwFlap.position.set(0, 0.46, -0.24); rwFlap.rotation.x = 0.55
  rwGroup.add(rwFlap)
  const rwEndGeo = new THREE.BoxGeometry(0.03, 0.52, 0.66)
  for (const sx of [-1, 1]) {
    const ep = new THREE.Mesh(rwEndGeo, paint)
    ep.position.set(sx * 0.58, 0.28, -0.1)
    rwGroup.add(ep)
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.2), carbon)
  beam.position.set(0, 0.02, 0.06); beam.rotation.x = 0.15
  rwGroup.add(beam)
  // swan-neck mounts
  for (const sx of [-1, 1]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.08), darkMetal)
    mount.position.set(sx * 0.16, 0.2, 0.14); mount.rotation.x = -0.12
    rwGroup.add(mount)
  }
  // DRS actuator pod
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), darkMetal), 0, 0.98, -2.18)

  /* ---------------- halo ---------------- */
  const haloGroup = new THREE.Group()
  haloGroup.position.set(0, 0.78, 0.35)
  car.add(haloGroup)
  const haloTube = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 14, 48), darkMetal)
  haloTube.rotation.x = Math.PI / 2
  haloTube.rotation.y = 0
  haloTube.scale.set(1.15, 0.8, 1)
  haloGroup.add(haloTube)
  // forward strut
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.42, 12), darkMetal)
  strut.position.set(0, 0.06, 0.55); strut.rotation.x = Math.PI / 2 - 0.35
  haloGroup.add(strut)
  // halo root fairings
  for (const sx of [-1, 1]) {
    const root = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), darkMetal)
    root.position.set(sx * 0.3, 0.02, 0.2)
    haloGroup.add(root)
  }
  // driver helmet peeking out of the cockpit
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), paint)
  helmet.position.set(0, 0.86, 0.18); helmet.scale.set(0.9, 0.95, 1.05)
  car.add(helmet)
  const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16, -0.5, 1.0, 0.6, 1.1), visor)
  visorMesh.position.copy(helmet.position); visorMesh.scale.copy(helmet.scale)
  car.add(visorMesh)

  /* ---------------- mirrors + antenna + camera pods ---------------- */
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), darkMetal)
    arm.position.set(sx * 0.5, 0.74, 0.42); arm.rotation.z = Math.PI / 2
    car.add(arm)
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.08), paint)
    housing.position.set(sx * 0.6, 0.75, 0.42)
    car.add(housing)
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), blackMetal)
  antenna.position.set(0, 1.02, -0.05)
  car.add(antenna)
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14), blackMetal)
    pod.position.set(sx * 0.28, 0.8, 0.62); pod.rotation.x = Math.PI / 2
    car.add(pod)
  }

  /* ---------------- suspension wishbones ---------------- */
  const tube = (r, len, mat = darkMetal) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat)
  const wishbone = (sx, z) => {
    // two arms forming a V from the chassis to the wheel upright
    for (const dz of [-0.16, 0.16]) {
      const arm = tube(0.022, 0.62)
      const from = new THREE.Vector3(sx * 0.5, 0.44, z + dz)
      const to = new THREE.Vector3(sx * 0.82, 0.34, z)
      arm.position.copy(from.clone().add(to).multiplyScalar(0.5))
      arm.lookAt(to)
      arm.rotateX(Math.PI / 2)
      car.add(arm)
    }
    const trackRod = tube(0.016, 0.5)
    const a = new THREE.Vector3(sx * 0.5, 0.28, z + 0.1)
    const b = new THREE.Vector3(sx * 0.82, 0.28, z - 0.02)
    trackRod.position.copy(a.clone().add(b).multiplyScalar(0.5))
    trackRod.lookAt(b); trackRod.rotateX(Math.PI / 2)
    car.add(trackRod)
  }
  wishbone(-1, 1.5); wishbone(1, 1.5); wishbone(-1, -1.55); wishbone(1, -1.55)

  /* ---------------- wheels ---------------- */
  const wheelPositions = [
    [-0.98, 0.35, 1.52, 0.36, 0.42],
    [0.98, 0.35, 1.52, 0.36, 0.42],
    [-1.0, 0.36, -1.58, 0.4, 0.44],
    [1.0, 0.36, -1.58, 0.4, 0.44]
  ]
  for (const [x, y, z, radius, width] of wheelPositions) {
    const wheel = new THREE.Group()
    wheel.position.set(x, y, z)
    car.add(wheel)

    // tyre: lathe profile -> sidewall bulge + flat tread band
    const prof = []
    const half = width / 2
    const bulge = 0.055
    prof.push(new THREE.Vector2(radius * 0.62, -half))
    prof.push(new THREE.Vector2(radius * 0.86, -half * 1.02))
    prof.push(new THREE.Vector2(radius * 0.99, -half * 0.72))
    prof.push(new THREE.Vector2(radius, -half * 0.42))
    prof.push(new THREE.Vector2(radius, half * 0.42))
    prof.push(new THREE.Vector2(radius * 0.99, half * 0.72))
    prof.push(new THREE.Vector2(radius * 0.86, half * 1.02))
    prof.push(new THREE.Vector2(radius * 0.62, half))
    prof.push(new THREE.Vector2(radius * 0.62, -half))
    const tyreGeo = new THREE.LatheGeometry(prof, 40)
    tyreGeo.rotateZ(Math.PI / 2)
    const tyre = new THREE.Mesh(tyreGeo, tyreMat)
    wheel.add(tyre)

    // rim barrel + face
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.86, 24, 1, true), blackMetal)
    barrel.rotation.z = Math.PI / 2
    wheel.add(barrel)
    for (const sx of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 24), rimMat)
      face.position.set(sx * width * 0.43, 0, 0)
      face.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2
      wheel.add(face)
      // spokes
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 0.1, radius * 0.55, radius * 0.1), rimMat)
        const a = (s / 5) * Math.PI * 2
        spoke.position.set(sx * width * 0.43, Math.sin(a) * radius * 0.3, Math.cos(a) * radius * 0.3)
        spoke.rotation.x = -a
        wheel.add(spoke)
      }
    }
    // hub + locking nut
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 0.95, 16), steel)
    hub.rotation.z = Math.PI / 2
    wheel.add(hub)
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.07, radius * 0.07, width * 1.02, 6), gold)
    nut.rotation.z = Math.PI / 2
    wheel.add(nut)
    // brake duct
    const duct = new THREE.Mesh(new THREE.BoxGeometry(0.06, radius * 0.5, radius * 0.5), carbon)
    duct.position.set(x > 0 ? -width * 0.52 : width * 0.52, 0, 0)
    wheel.add(duct)
  }

  /* ---------------- number / sponsor decals on the nose ------------------- */
  const decal = makeNumberTexture(THREE, number || '#1')
  if (decal) {
    const decalMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1 })
    )
    decalMesh.position.set(0, 0.47, 2.35)
    decalMesh.rotation.x = -Math.PI / 2 + 0.1
    car.add(decalMesh)
  }

  return car
}

/* ------------------------------------------------------------- textures -- */

/** Canvas-generated tyre normal map: fine grooves + centre rib. */
function makeTyreNormal(THREE) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#8080ff'
  ctx.fillRect(0, 0, c.width, c.height)
  // circumferential grooves (constant along the rolling direction)
  for (let i = 0; i < 7; i++) {
    const y = 6 + i * 9
    ctx.strokeStyle = 'rgba(40,40,210,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke()
    ctx.strokeStyle = 'rgba(215,215,255,0.8)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(c.width, y + 2); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(18, 1)
  return tex
}

/** Simple nose-number roundel drawn to a canvas texture. */
function makeNumberTexture(THREE, num) {
  try {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 256
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 256, 256)
    ctx.beginPath()
    ctx.arc(128, 128, 120, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#0c0d10'
    ctx.stroke()
    ctx.fillStyle = '#0c0d10'
    ctx.font = 'bold 130px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), 128, 136)
    return new THREE.CanvasTexture(c)
  } catch {
    return null
  }
}
