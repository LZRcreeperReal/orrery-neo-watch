import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS, heliocentricPosition, orbitPath } from './orbitalElements.js';

const AU = 22;                 // scene units per astronomical unit (orbits are to scale)
const SPEED_DAYS_PER_SEC = [0.2, 1, 5, 20, 80];
const SPEED_LABELS = ['0.2×', '1×', '5×', '20×', '80×'];

let scene, camera, renderer, controls, stage, canvas;
let sunMesh, starField;
let neoGroup;
const bodies = []; // { def, mesh, orbitLine }

let simTime = new Date();
let playing = true;
let speedIndex = 2;
let lastFrameMs = performance.now();
let epochThrottle = 0;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = null;

function planetVisualRadius(def) {
  // deliberately not to distance-scale — sized for legibility, relative order preserved
  const table = {
    mercury: 0.7, venus: 1.15, earth: 1.2, mars: 0.9,
    jupiter: 3.3, saturn: 2.9, uranus: 1.9, neptune: 1.85,
  };
  return table[def.key] || 1;
}

function buildStarfield() {
  const count = 3200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 1400 + Math.random() * 1400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x8fa3c9, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.7 });
  starField = new THREE.Points(geo, mat);
  scene.add(starField);
}

function buildSun() {
  const geo = new THREE.SphereGeometry(4.6, 32, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffcf7a });
  sunMesh = new THREE.Mesh(geo, mat);
  sunMesh.userData.isSun = true;
  scene.add(sunMesh);

  const glow = new THREE.PointLight(0xfff2d6, 2.4, 0, 0); // no distance attenuation
  scene.add(glow);
  scene.add(new THREE.AmbientLight(0x3a4258, 1.1));

  const haloGeo = new THREE.SphereGeometry(6.4, 24, 24);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.12, side: THREE.BackSide });
  sunMesh.add(new THREE.Mesh(haloGeo, haloMat));
}

function buildPlanets() {
  PLANETS.forEach((def) => {
    const r = planetVisualRadius(def);
    const geo = new THREE.SphereGeometry(r, 28, 28);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.planetKey = def.key;
    scene.add(mesh);

    if (def.key === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 1.4, r * 2.3, 64),
        new THREE.MeshBasicMaterial({ color: 0xcbb27a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = Math.PI / 2.4;
      mesh.add(ring);
    }

    const pathPts = orbitPath(def, simTime).map(p => new THREE.Vector3(p.x * AU, p.z * AU, -p.y * AU));
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(pathPts);
    const orbitMat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.35 });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    scene.add(orbitLine);

    bodies.push({ def, mesh, orbitLine });
  });
}

function updatePositions() {
  bodies.forEach(({ def, mesh }) => {
    const pos = heliocentricPosition(def, simTime);
    // ecliptic (x,y,z AU) -> three.js scene (x, up=z, -y forward)
    mesh.position.set(pos.x * AU, pos.z * AU, -pos.y * AU);
    mesh.userData.pos = pos;
  });
}

function buildLegend() {
  const legend = document.getElementById('orreryLegend');
  if (!legend) return;
  legend.innerHTML = '';
  const sunItem = document.createElement('div');
  sunItem.className = 'orrery-legend__item';
  sunItem.innerHTML = `<span class="orrery-legend__dot" style="background:#ffcf7a"></span>Sun`;
  sunItem.addEventListener('click', () => selectSun());
  legend.appendChild(sunItem);

  bodies.forEach(({ def }) => {
    const item = document.createElement('div');
    item.className = 'orrery-legend__item';
    item.innerHTML = `<span class="orrery-legend__dot" style="background:${def.color}"></span>${def.name}`;
    item.addEventListener('click', () => selectPlanet(def.key));
    legend.appendChild(item);
  });
}

function fmtAu(n) { return `${n.toFixed(3)} AU`; }
function fmtDays(n) {
  if (n > 500) return `${(n / 365.25).toFixed(2)} yr`;
  return `${n.toFixed(1)} d`;
}

function selectPlanet(key) {
  const body = bodies.find(b => b.def.key === key);
  const panel = document.getElementById('planetPanel');
  if (!body || !panel) return;
  const pos = body.mesh.userData.pos || heliocentricPosition(body.def, simTime);
  panel.innerHTML = `
    <h2 class="planet-card__name">${body.def.name}</h2>
    <span class="planet-card__type">Terrestrial / Giant — Planet</span>
    <div class="planet-card__row"><span>Distance from Sun</span><span>${fmtAu(pos.distanceAu)}</span></div>
    <div class="planet-card__row"><span>Semi-major axis</span><span>${fmtAu(pos.a)}</span></div>
    <div class="planet-card__row"><span>Eccentricity</span><span>${pos.e.toFixed(4)}</span></div>
    <div class="planet-card__row"><span>Inclination</span><span>${pos.i.toFixed(2)}°</span></div>
    <div class="planet-card__row"><span>Orbital period</span><span>${fmtDays(pos.periodDays)}</span></div>
  `;
}

function selectSun() {
  const panel = document.getElementById('planetPanel');
  if (!panel) return;
  panel.innerHTML = `
    <h2 class="planet-card__name">Sun</h2>
    <span class="planet-card__type">G-type main-sequence star</span>
    <div class="planet-card__row"><span>Mass</span><span>1.989 × 10³⁰ kg</span></div>
    <div class="planet-card__row"><span>Radius</span><span>696,340 km</span></div>
    <div class="planet-card__row"><span>Bodies orbiting</span><span>${PLANETS.length} shown</span></div>
  `;
}

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
}
function onPointerUp(e) {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x, dy = e.clientY - pointerDownPos.y;
  pointerDownPos = null;
  if (Math.hypot(dx, dy) > 6) return; // was a drag, not a tap

  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const targets = bodies.map(b => b.mesh).concat(sunMesh);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) {
    const hit = hits[0].object;
    if (hit.userData.isSun) selectSun();
    else if (hit.userData.planetKey) selectPlanet(hit.userData.planetKey);
  }
}

function resize() {
  if (!stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function updateHud() {
  const epochEl = document.getElementById('epochReadout');
  if (epochEl) {
    epochEl.textContent = simTime.toISOString().slice(0, 16).replace('T', '  ') + ' UTC';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dtSec = Math.min((now - lastFrameMs) / 1000, 0.25);
  lastFrameMs = now;

  if (playing) {
    const daysPerSec = SPEED_DAYS_PER_SEC[speedIndex];
    simTime = new Date(simTime.getTime() + daysPerSec * dtSec * 86400000);
  }
  updatePositions();

  epochThrottle += dtSec;
  if (epochThrottle > 0.15) { updateHud(); epochThrottle = 0; }

  controls.update();
  renderer.render(scene, camera);
}

function wireControls() {
  const playPauseBtn = document.getElementById('playPauseBtn');
  const speedSlider = document.getElementById('speedSlider');
  const speedReadout = document.getElementById('speedReadout');
  const resetBtn = document.getElementById('resetTimeBtn');

  playPauseBtn?.addEventListener('click', () => {
    playing = !playing;
    playPauseBtn.textContent = playing ? '❙❙' : '▶';
    playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  });
  speedSlider?.addEventListener('input', (e) => {
    speedIndex = Number(e.target.value);
    if (speedReadout) speedReadout.textContent = SPEED_LABELS[speedIndex];
  });
  resetBtn?.addEventListener('click', () => { simTime = new Date(); });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
}

/** Plot illustrative (not-to-scale) markers near Earth representing fetched NEOs. */
function plotNeoMarkers(neoList) {
  if (!neoGroup) {
    neoGroup = new THREE.Group();
    scene.add(neoGroup);
  }
  neoGroup.clear();
  if (!neoList || !neoList.length) return;

  const earthBody = bodies.find(b => b.def.key === 'earth');
  if (!earthBody) return;
  const earthPos = earthBody.mesh.position;

  const sample = neoList.slice(0, 60);
  sample.forEach((neo, idx) => {
    const angle = (idx / sample.length) * Math.PI * 2;
    const ring = 3.2 + (idx % 5) * 0.9; // spiral out purely for legibility, not to scale
    const geo = new THREE.SphereGeometry(neo.hazardous ? 0.22 : 0.14, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: neo.hazardous ? 0xe2555a : 0x4fb0c6 });
    const dot = new THREE.Mesh(geo, mat);
    dot.position.set(
      earthPos.x + Math.cos(angle) * ring,
      earthPos.y + Math.sin(idx * 1.7) * 1.2,
      earthPos.z + Math.sin(angle) * ring
    );
    neoGroup.add(dot);
  });
}

function init() {
  stage = document.querySelector('.orrery-stage');
  canvas = document.getElementById('solarCanvas');
  if (!stage || !canvas) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, stage.clientWidth / Math.max(stage.clientHeight, 1), 0.1, 4000);
  camera.position.set(0, 160, 210);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05070c, 1);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 1500;

  buildStarfield();
  buildSun();
  buildPlanets();
  buildLegend();
  updatePositions();
  updateHud();
  wireControls();

  resize();
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  lastFrameMs = performance.now();
  animate();

  // exposed for main.js (tab switch) and neoDashboard.js (cross-view marker overlay)
  window.__orrery = { resize, plotNeoMarkers, jumpToDate: (d) => { simTime = new Date(d); } };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
