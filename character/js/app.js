// app.js — Khung cảnh, điều khiển, máy trạng thái, demo tự động, giao diện.
// Luồng mỗi frame:  input → quyết định trạng thái → di chuyển "Mover" → resetPose → POSES[state]
//                   → blend với tư thế cũ → biểu cảm (lerp + chớp mắt + nhìn camera) → render.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildCharacter, resetPose, setColors, capturePose, blendFromSnapshot, PALETTE } from './character.js';
import { applyFace, lerpFace, EXPRESSIONS, FACE_DEFAULT } from './face.js';
import { POSES, STATES } from './poses.js';
import { exportGLB } from './export.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

const params = new URLSearchParams(location.search);
const FROZEN = params.has('state');          // chế độ chụp ảnh tĩnh (dùng cho tài liệu / test)
if (params.get('ui') === '0') document.body.classList.add('noui');

// ---------------- Khung cảnh ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: FROZEN });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#CDEBFF');
scene.fog = new THREE.Fog('#CDEBFF', 20, 45);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 2.2, 5.6);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight('#ffffff', '#8fc97a', 1.0));
const sun = new THREE.DirectionalLight('#fff4d6', 2.4);
sun.position.set(4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.15;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshToonMaterial({ color: '#BFE8A6' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Vài bụi cây để cảm nhận được chuyển động (vị trí cố định, không ngẫu nhiên)
{
  const bushGeo = new THREE.SphereGeometry(1, 16, 12);
  const bushMats = ['#7CC46B', '#69B85E', '#8AD077'].map((c) => new THREE.MeshToonMaterial({ color: c }));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + (i % 3) * 0.17;
    const r = 6.5 + ((i * 7) % 5) * 1.4;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(bushGeo, bushMats[(i + j) % 3]);
      const s = 0.45 + ((i + j) % 3) * 0.15;
      m.scale.set(s, s * 0.8, s);
      m.position.set((j - 1) * 0.45, s * 0.6, (j % 2) * 0.2);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    scene.add(g);
  }
}

// ---------------- Nhân vật ----------------
const { root, nodes, rest, mats } = buildCharacter();
const mover = new THREE.Group();          // vị trí & hướng trên sân (KHÔNG xuất ra GLB)
mover.name = 'Mover';
mover.add(root);
scene.add(mover);

const S = {
  state: 'idle', stateT: 0,
  flying: false,
  lock: false,              // true = không tự đổi trạng thái (ảnh tĩnh)
  autoMove: null,            // 'walk' | 'run' | 'fly' khi bấm nút (đi vòng tròn)
  manualFace: null,          // biểu cảm người dùng chọn; null = theo trạng thái
  snap: null, blendT: 1, BLEND: 0.22,
  face: { ...FACE_DEFAULT },
  blink: { next: 1.5, t: -1 },
  yaw: 0, speed: 0,
  landSquash: -1,
  demo: null,
};

const isOneShot = (s) => !STATES[s].loop;

function setState(s) {
  if (S.state === s) return;
  S.snap = capturePose(nodes);
  S.blendT = 0;
  S.state = s;
  S.stateT = 0;
}

function trigger(action) {           // jump | roll | slide
  if (isOneShot(S.state)) return;
  if (S.flying) return;
  setState(action);
}

function setFlying(on) {
  S.flying = on;
  if (on) setState('fly');
}

// ---------------- Input ----------------
const keys = new Set();
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (MOVE_KEYS.includes(e.code)) { stopDemo(); S.autoMove = null; }
  if (e.code === 'Space') { stopDemo(); trigger('jump'); }
  if (e.code === 'KeyR' || e.code === 'KeyK') { stopDemo(); trigger('roll'); }
  if (e.code === 'KeyC' || e.code === 'KeyL') { stopDemo(); trigger('slide'); }
  if (e.code === 'KeyF') { stopDemo(); setFlying(!S.flying); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
function inputVector() {
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  const mag = Math.hypot(x, z);
  if (mag === 0) return { mag: 0, dir: _f.set(0, 0, 0) };
  // Hướng đi tính theo camera (W = đi ra xa khỏi camera)
  _f.subVectors(controls.target, camera.position).setY(0).normalize();
  _r.set(_f.z, 0, -_f.x);
  const dir = new THREE.Vector3().addScaledVector(_f, -z / mag).addScaledVector(_r, x / mag);
  return { mag: 1, dir };
}

function approachAngle(cur, target, maxStep) {
  let d = ((target - cur + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return cur + clamp(d, -maxStep, maxStep);
}

// ---------------- Demo tự động ----------------
const DEMO = [
  { state: 'idle', face: 'neutral', dur: 1.2 },
  ...Object.keys(EXPRESSIONS).filter((k) => k !== 'neutral').map((k) => ({ state: 'idle', face: k, dur: 1.3 })),
  { state: 'walk', dur: 3.2 },
  { state: 'run', dur: 3.2 },
  { state: 'idle', dur: 0.6 },
  { state: 'jump', dur: 1.3 },
  { state: 'idle', dur: 0.4 },
  { state: 'roll', dur: 1.1 },
  { state: 'idle', dur: 0.4 },
  { state: 'slide', dur: 1.3 },
  { state: 'idle', dur: 0.6 },
  { state: 'fly', dur: 4.5 },
  { state: 'idle', dur: 1.6 },
];

function applyAction(state) {
  switch (state) {
    case 'idle': S.autoMove = null; setFlying(false); break;
    case 'walk': case 'run': setFlying(false); S.autoMove = state; break;
    case 'fly': S.autoMove = 'fly'; setFlying(true); break;
    default: S.autoMove = null; setFlying(false); trigger(state);
  }
}

function demoStep(i) {
  const d = DEMO[i];
  S.manualFace = d.face || null;
  applyAction(d.state);
}

function startDemo() {
  S.demo = { i: 0, t: 0 };
  demoStep(0);
  ui.demo.classList.add('on');
}
function stopDemo() {
  if (!S.demo) return;
  S.demo = null;
  S.manualFace = null;
  ui.demo.classList.remove('on');
}

// ---------------- Cập nhật mỗi frame ----------------
const _tmp = new THREE.Vector3();
function update(dt) {
  dt = Math.min(dt, 0.05);

  if (S.demo) {
    S.demo.t += dt;
    if (S.demo.t >= DEMO[S.demo.i].dur) {
      S.demo.i = (S.demo.i + 1) % DEMO.length;
      S.demo.t = 0;
      demoStep(S.demo.i);
    }
  }

  S.stateT += dt;
  let st = STATES[S.state];
  if (!st.loop && S.stateT >= st.duration) setState(S.flying ? 'fly' : 'idle');

  // ---- Quyết định trạng thái liên tục từ input ----
  const inp = inputVector();
  let moving = inp.mag > 0;
  let wantRun = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (S.autoMove) {
    moving = true;
    wantRun = S.autoMove === 'run';
    S.yaw += 0.55 * dt;
  } else if (moving) {
    S.yaw = approachAngle(S.yaw, Math.atan2(inp.dir.x, inp.dir.z), 10 * dt);
  }
  if (STATES[S.state].loop && !S.lock) {
    if (S.flying) setState('fly');
    else if (moving) setState(wantRun ? 'run' : 'walk');
    else setState('idle');
  }
  st = STATES[S.state];

  // ---- Tốc độ & di chuyển ----
  let target = 0;
  if (S.state === 'walk' || S.state === 'run') target = st.speed;
  else if (S.state === 'fly') target = moving ? st.speed : 0;
  else if (S.state === 'roll') target = st.speed * (1 - 0.4 * S.stateT / st.duration);
  else if (S.state === 'slide') target = lerp(st.speed, 1.0, S.stateT / st.duration);
  else if (S.state === 'jump') target = S.speed * 0.995;
  S.speed = st.loop ? lerp(S.speed, target, Math.min(1, 8 * dt)) : target;

  mover.rotation.y = S.yaw;
  _tmp.set(Math.sin(S.yaw), 0, Math.cos(S.yaw));
  mover.position.addScaledVector(_tmp, S.speed * dt);
  const rad = Math.hypot(mover.position.x, mover.position.z);
  if (rad > 13) {                                     // giữ trong sân
    mover.position.x *= 13 / rad;
    mover.position.z *= 13 / rad;
    if (S.autoMove) S.yaw += 1.5 * dt;
  }
  const targetY = S.flying ? 1.8 : 0;
  const wasAir = mover.position.y > 0.08;
  mover.position.y = lerp(mover.position.y, targetY, Math.min(1, (S.flying ? 3 : 6) * dt));
  if (!S.flying && mover.position.y < 0.03) {
    if (wasAir) S.landSquash = 0;
    mover.position.y = 0;
  }

  // ---- Tư thế ----
  resetPose(nodes, rest);
  POSES[S.state](nodes, S.stateT);
  if (S.blendT < S.BLEND && S.snap) {
    S.blendT += dt;
    blendFromSnapshot(nodes, S.snap, sm(S.blendT / S.BLEND));
  }
  if (S.landSquash >= 0) {                            // tiếp đất sau khi bay
    S.landSquash += dt;
    const k = S.landSquash / 0.35;
    if (k >= 1) S.landSquash = -1;
    else {
      const b = Math.sin(Math.PI * k);
      nodes.Root.scale.multiply(_tmp.set(1 + 0.12 * b, 1 - 0.25 * b, 1 + 0.12 * b));
    }
  }

  // ---- Biểu cảm ----
  const faceKey = S.manualFace || st.face;
  lerpFace(S.face, EXPRESSIONS[faceKey].params, 1 - Math.exp(-12 * dt));
  const look = computeLook();
  S.face.lookX = lerp(S.face.lookX, look.x, Math.min(1, 6 * dt));
  S.face.lookY = lerp(S.face.lookY, look.y, Math.min(1, 6 * dt));
  const f = { ...S.face };
  if (!FROZEN) {
    S.blink.next -= dt;
    if (S.blink.next <= 0 && S.blink.t < 0 && f.lidTop < 0.5) { S.blink.t = 0; S.blink.next = 1.8 + Math.random() * 3.5; }
    if (S.blink.t >= 0) {
      S.blink.t += dt;
      const k = S.blink.t / 0.18;
      if (k >= 1) S.blink.t = -1;
      else {
        const b = Math.sin(Math.PI * k);
        f.lidTop = Math.max(f.lidTop, b);
        f.lidBot = Math.max(f.lidBot, b * 0.3);
      }
    }
  }
  applyFace(nodes, f);

  // ---- Camera & nắng đi theo nhân vật ----
  if (!FROZEN) {
    _tmp.copy(mover.position).y += 0.9;
    const d = _tmp.sub(controls.target).multiplyScalar(Math.min(1, 5 * dt));
    controls.target.add(d);
    camera.position.add(d);
  }
  sun.position.set(mover.position.x + 4, 8, mover.position.z + 5);
  sun.target.position.copy(mover.position);
  controls.update();
  updateHud(faceKey);
}

// Con ngươi liếc về phía camera (chỉ lúc chạy thật; khi lăn thì không)
const _cam = new THREE.Vector3();
function computeLook() {
  if (S.state === 'roll') return { x: 0, y: 0 };
  nodes.Head.updateWorldMatrix(true, false);
  _cam.copy(camera.position);
  nodes.Head.worldToLocal(_cam).normalize();
  return { x: clamp(_cam.x * 1.6, -1, 1), y: clamp(_cam.y * 1.6, -1, 1) };
}

// ---------------- Giao diện ----------------
const ui = {
  hudState: document.getElementById('hud-state'),
  hudFace: document.getElementById('hud-face'),
  demo: document.getElementById('btn-demo'),
  msg: document.getElementById('msg'),
  panel: document.getElementById('panel'),
};
let lastHud = '';
function updateHud(faceKey) {
  const key = S.state + '|' + faceKey + '|' + (S.manualFace || 'auto');
  if (key === lastHud) return;
  lastHud = key;
  ui.hudState.textContent = STATES[S.state].label;
  ui.hudFace.textContent = EXPRESSIONS[faceKey].label + (S.manualFace ? '' : ' (tự động)');
  document.querySelectorAll('[data-state]').forEach((b) => b.classList.toggle('on', b.dataset.state === S.state));
  document.querySelectorAll('[data-face]').forEach((b) => b.classList.toggle('on', b.dataset.face === (S.manualFace || 'auto')));
}

function say(text) {
  ui.msg.textContent = text;
  ui.msg.classList.add('show');
  clearTimeout(say.timer);
  say.timer = setTimeout(() => ui.msg.classList.remove('show'), 3500);
}

function buildUI() {
  const stBox = document.getElementById('states');
  for (const [key, st] of Object.entries(STATES)) {
    const b = document.createElement('button');
    b.dataset.state = key;
    b.innerHTML = `${st.label}${st.key ? `<kbd>${st.key}</kbd>` : ''}`;
    b.onclick = () => { stopDemo(); applyAction(key); };
    stBox.appendChild(b);
  }
  const fBox = document.getElementById('faces');
  const auto = document.createElement('button');
  auto.dataset.face = 'auto';
  auto.textContent = 'Tự động';
  auto.onclick = () => { S.manualFace = null; };
  fBox.appendChild(auto);
  for (const [key, ex] of Object.entries(EXPRESSIONS)) {
    const b = document.createElement('button');
    b.dataset.face = key;
    b.textContent = ex.label;
    b.onclick = () => { if (S.demo) stopDemo(); S.manualFace = key; };
    fBox.appendChild(b);
  }
  for (const id of ['body', 'belly', 'accent', 'leaf']) {
    const inp = document.getElementById('col-' + id);
    inp.value = PALETTE[id];
    inp.oninput = () => setColors(mats, { [id]: inp.value });
  }
  ui.demo.onclick = () => (S.demo ? stopDemo() : startDemo());
  document.getElementById('btn-export').onclick = async () => {
    say('Đang bake animation & xuất GLB…');
    try {
      const snapState = { state: S.state, t: S.stateT };
      const bytes = await exportGLB(root, nodes, rest, 'bong.glb');
      S.state = snapState.state; S.stateT = snapState.t;
      say(`Đã xuất bong.glb (${(bytes / 1024).toFixed(0)} KB) – mở bằng Blender / Unity / Godot.`);
    } catch (e) {
      console.error(e);
      say('Xuất thất bại: ' + e.message);
    }
  };
  document.getElementById('btn-cam').onclick = () => {
    camera.position.set(mover.position.x, 2.2, mover.position.z + 5.6);
    controls.target.set(mover.position.x, 0.9, mover.position.z);
  };
  document.getElementById('btn-toggle').onclick = () => ui.panel.classList.toggle('collapsed');
  if (window.__NO_DOWNLOAD__) {        // bản xem thử online: trình xem chặn tải file
    document.getElementById('btn-export').hidden = true;
    document.getElementById('export-note').hidden = false;
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------- Khởi động ----------------
buildUI();
resize();

const CAMS = {
  front: { pos: [0, 1.5, 4.4], target: [0, 0.95, 0] },
  side:  { pos: [4.4, 1.5, 0], target: [0, 0.95, 0] },
  tq:    { pos: [3.1, 2.1, 3.4], target: [0, 0.9, 0] },
  face:  { pos: [0, 1.5, 2.3], target: [0, 1.42, 0] },
  back:  { pos: [0, 1.6, -4.4], target: [0, 0.95, 0] },
};

if (FROZEN) {
  // Ảnh tĩnh: ?state=walk&t=0.3&face=happy&cam=front
  const state = STATES[params.get('state')] ? params.get('state') : 'idle';
  const t = parseFloat(params.get('t') || '0');
  const cam = CAMS[params.get('cam') || 'front'];
  const lift = parseFloat(params.get('lift') || '0');   // nâng camera lên khi nhân vật ở trên cao
  if (params.get('face')) S.manualFace = params.get('face');
  S.lock = true;
  S.state = state;
  S.flying = state === 'fly';
  mover.position.set(0, S.flying ? 1.2 : 0, 0);
  controls.enableDamping = false;
  // chạy vài frame để biểu cảm (lerp) hội tụ, luôn giữ đúng thời điểm t
  for (let i = 0; i < 90; i++) { S.stateT = t; update(1 / 60); mover.position.set(0, S.flying ? 1.2 : 0, 0); }
  S.stateT = t; update(0);
  mover.position.set(0, S.flying ? 1.2 : 0, 0);
  mover.rotation.y = 0;
  camera.position.set(cam.pos[0], cam.pos[1] + lift, cam.pos[2]);
  controls.target.set(cam.target[0], cam.target[1] + lift, cam.target[2]);
  controls.update();
  renderer.render(scene, camera);
  window.__ready = true;
} else {
  if (params.get('demo') !== '0') startDemo();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    update(clock.getDelta());
    renderer.render(scene, camera);
  });
  window.__ready = true;
}

// Cho phép chọc vào từ console / test
window.BONG = { S, nodes, rest, mats, setState, trigger, setFlying, applyAction, startDemo, stopDemo, STATES, EXPRESSIONS };
