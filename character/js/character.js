// character.js — Dựng mô hình "Gấu béo" từ các khối cơ bản (sphere / capsule / cone).
// Mọi bộ phận đều là Object3D có TÊN DUY NHẤT (xem bảng tên trong docs/CHARACTER_DESIGN.md).
// Tên này được dùng ở 3 nơi: poses.js (animation), face.js (biểu cảm) và export.js (xuất GLB).
import * as THREE from 'three';

export const PALETTE = {
  body:   '#C9966F', // lông chính (nâu mật ong)
  belly:  '#F1DCC2', // bụng / mõm / tai trong (kem)
  accent: '#5E3A2E', // tay, chân, đuôi sọc, mũi (nâu đậm)
  leaf:   '#7CCB5A', // lá trên đầu
  cheek:  '#F29AA6', // má hồng
  eye:    '#FFFFFF',
  pupil:  '#1E1B22',
  mouth:  '#6E2F34',
  tongue: '#FF7B9C',
};

// Gradient 3 bậc cho MeshToonMaterial → nhìn "hoạt hình", ít chi tiết, hợp trẻ em.
function makeGradientMap() {
  const data = new Uint8Array([
    120, 120, 120, 255,
    200, 200, 200, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tạo nhân vật. Trả về:
 *  - root  : Group gốc (pivot ở mặt đất, giữa 2 chân)
 *  - nodes : { tên → Object3D } để animation / biểu cảm / export tra cứu
 *  - rest  : tư thế nghỉ (position / quaternion / scale) của từng node
 *  - mats  : vật liệu, để đổi màu lúc chạy
 */
export function buildCharacter() {
  const nodes = {};
  const grad = makeGradientMap();
  const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: grad });
  const mats = {
    body: toon(PALETTE.body),
    belly: toon(PALETTE.belly),
    accent: toon(PALETTE.accent),
    leaf: toon(PALETTE.leaf),
    cheek: toon(PALETTE.cheek),
    eye: new THREE.MeshToonMaterial({ color: PALETTE.eye, gradientMap: grad, emissive: '#666666' }),
    pupil: new THREE.MeshToonMaterial({ color: PALETTE.pupil, gradientMap: grad, emissive: '#111111' }),
    shine: new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
    mouth: toon(PALETTE.mouth),
    tongue: toon(PALETTE.tongue),
  };

  // Hình học dùng chung
  const SPHERE = new THREE.SphereGeometry(1, 40, 28);
  const sphere = (r, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h);
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
  // Mí mắt = chỏm cầu nửa trước (+Z) ; xoay quanh trục X để mở / nhắm
  const lidGeo = (r) => new THREE.SphereGeometry(r, 24, 12, 0, Math.PI, 0, Math.PI);

  const G = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    nodes[name] = g;
    return g;
  };
  const M = (name, parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    nodes[name] = m;
    return m;
  };
  const E = (name, parent, mat, x, y, z, sx, sy, sz) => {   // ellipsoid tiện tay
    const m = M(name, parent, SPHERE, mat, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };

  // ---------- Khung xương (hierarchy) ----------
  const root = new THREE.Group();
  root.name = 'Root';
  nodes.Root = root;

  const hips = G('Hips', root, 0, 0.45, 0);

  // Thân: một khối tròn ú, bụng kem phía trước, 3 chấm bụng
  E('Body', hips, mats.body, 0, 0.17, 0, 0.60, 0.54, 0.54);
  E('Belly', hips, mats.belly, 0, 0.06, 0.40, 0.36, 0.33, 0.18);
  for (let i = 0; i < 3; i++) {
    E('BellyDot' + i, hips, mats.body, (i - 1) * 0.13, 0.12 - Math.abs(i - 1) * 0.03, 0.555, 0.028, 0.045, 0.02);
  }

  // Đuôi: bầu dục dựng đứng phía sau, 2 vòng sọc nâu đậm
  const tail = G('Tail', hips, 0, 0.12, -0.50);
  tail.rotation.x = 0.35;
  E('TailMesh', tail, mats.body, 0, 0.22, 0, 0.21, 0.30, 0.17);
  for (const [i, h] of [[0, 0.10], [1, 0.30]]) {
    const rx = 0.21 * Math.sqrt(Math.max(0, 1 - ((h - 0.22) / 0.30) ** 2)) + 0.012;
    const ring = M('TailStripe' + i, tail, new THREE.TorusGeometry(1, 0.035, 10, 32), mats.accent, 0, h, 0);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(rx, rx * 0.8, 1);
  }

  // Tay + chân: đối xứng L (+X) / R (-X)
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    // Chân: ngắn, lòi ra phía trước dưới bụng
    const leg = G('Leg' + side, hips, 0.22 * sg, -0.02, 0.14);
    M('Shin' + side, leg, capsule(0.11, 0.10), mats.accent, 0, -0.22, 0);
    E('Foot' + side, leg, mats.accent, 0, -0.35, 0.09, 0.14, 0.09, 0.19);

    // Tay: ngắn, mặc định đặt lên bụng (hướng tay = từ vai tới điểm trên bụng)
    const sh = G('Shoulder' + side, hips, 0.42 * sg, 0.26, 0.30);
    const dir = new THREE.Vector3(-0.14 * sg, -0.11, 0.22).normalize();
    sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    M('Arm' + side, sh, capsule(0.10, 0.12), mats.accent, 0, -0.12, 0);
    M('Hand' + side, sh, sphere(0.12), mats.accent, 0, -0.26, 0);
  }

  // Cổ → Đầu dính liền thân (không có khe cổ)
  const neck = G('Neck', hips, 0, 0.45, 0);
  const head = M('Head', neck, sphere(0.52, 48, 32), mats.body, 0, 0.25, 0);
  // Đầu world: tâm y = 1.15, đỉnh 1.67

  // Tai tròn + tai trong kem
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const ear = G('Ear' + side, head, 0.37 * sg, 0.40, -0.04);
    M('EarMesh' + side, ear, sphere(0.15), mats.body);
    E('EarInner' + side, ear, mats.belly, 0, 0, 0.08, 0.085, 0.085, 0.05);
  }

  // Mõm kem + mũi
  E('Muzzle', head, mats.belly, 0, -0.14, 0.40, 0.27, 0.20, 0.17);
  E('Nose', head, mats.accent, 0, -0.06, 0.565, 0.075, 0.05, 0.05);

  // ---------- Khuôn mặt (con của Head, toạ độ quanh tâm đầu) ----------
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const eye = G('Eye' + side, head, 0.20 * sg, 0.07, 0.42);
    M('Eyeball' + side, eye, sphere(0.105), mats.eye);
    // Mắt to đen bóng: con ngươi gần bằng tròng, 2 chấm sáng
    const pupil = M('Pupil' + side, eye, sphere(0.085, 20, 14), mats.pupil, 0, 0, 0.04);
    pupil.userData.baseZ = 0.04;
    const shine = M('Shine' + side, eye, sphere(0.026, 8, 6), mats.shine, 0.03 * sg, 0.035, 0.11);
    shine.userData.base = { x: 0.03 * sg, y: 0.035 };
    shine.castShadow = false;
    const shine2 = M('Shine2' + side, eye, sphere(0.012, 8, 6), mats.shine, -0.03 * sg, -0.035, 0.115);
    shine2.castShadow = false;
    const lt = M('LidTop' + side, eye, lidGeo(0.135), mats.body);
    const lb = M('LidBot' + side, eye, lidGeo(0.131), mats.body);
    lt.rotation.order = 'ZXY';
    lb.rotation.order = 'ZXY';

    // Lông mày: mảnh, cùng màu lông đậm, bám theo mặt cầu
    const brow = G('Brow' + side, head, 0.20 * sg, 0.24, 0.42);
    brow.rotation.x = -0.45;
    brow.userData.baseY = 0.24;
    const browMesh = M('BrowMesh' + side, brow, capsule(0.017, 0.09), mats.accent);
    browMesh.rotation.z = Math.PI / 2;

    // Má hồng (trên 2 bên mõm)
    const cheek = E('Cheek' + side, head, mats.cheek, 0.31 * sg, -0.13, 0.36, 0.06, 0.045, 0.02);
    cheek.rotation.y = 0.75 * sg;
    cheek.userData.base = { x: 0.06, y: 0.045, z: 0.02 };

    // 3 túm lông má kem, mềm, hơi vuốt ra sau
    for (let i = 0; i < 3; i++) {
      const w = G('Whisker' + side + i, head, 0.40 * sg, -0.04 + (1 - i) * 0.065, 0.24);
      w.rotation.y = sg * 0.55;
      w.rotation.z = (1 - i) * 0.3 * sg;
      const tuftMesh = E('WhiskerMesh' + side + i, w, mats.belly, 0.07 * sg, 0, 0, 0.085, 0.028, 0.04);
      tuftMesh.castShadow = false;
    }
  }

  // Miệng: chuỗi 5 đoạn capsule, bẻ góc theo "curve" → cười / mếu mà độ dày không đổi
  const mouth = G('Mouth', head, 0, -0.19, 0.555);
  mouth.rotation.x = 0.35;
  const segMesh = (name, parent) => {
    const m = M(name, parent, capsule(0.015, 0.035), mats.mouth);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  segMesh('MouthC', mouth);
  const ml1 = G('MouthL1', mouth, -0.018, 0, 0);
  segMesh('MouthL1Mesh', ml1).position.x = -0.018;
  const ml2 = G('MouthL2', ml1, -0.036, 0, 0);
  segMesh('MouthL2Mesh', ml2).position.x = -0.018;
  const mr1 = G('MouthR1', mouth, 0.018, 0, 0);
  segMesh('MouthR1Mesh', mr1).position.x = 0.018;
  const mr2 = G('MouthR2', mr1, 0.036, 0, 0);
  segMesh('MouthR2Mesh', mr2).position.x = 0.018;
  // Khoang miệng (mở) + lưỡi
  E('MouthOpen', mouth, mats.mouth, 0, -0.015, -0.005, 0.001, 0.001, 0.001);
  E('Tongue', mouth, mats.tongue, 0, -0.03, 0.01, 0.001, 0.001, 0.001);

  // Lá trên đầu: một lá to + một lá nhỏ; khi bay thì "Prop" xoay như cánh quạt
  const tuft = G('Tuft', head, 0, 0.50, 0.02);
  tuft.rotation.x = -0.15;
  M('Stem', tuft, capsule(0.018, 0.06), mats.leaf, 0, 0.03, 0);
  const prop = G('Prop', tuft, 0, 0.07, 0);
  const leafA = E('LeafA', prop, mats.leaf, 0.13, 0.02, 0, 0.17, 0.03, 0.085);
  leafA.rotation.z = 0.25;
  const leafB = E('LeafB', prop, mats.leaf, -0.07, 0.0, 0, 0.08, 0.02, 0.045);
  leafB.rotation.z = -0.3;

  // Chi tiết mặt nhỏ: không đổ bóng để hốc mắt / miệng không bị tối
  head.traverse((o) => { if (o.isMesh && o !== head && !o.name.startsWith('Ear')) o.castShadow = false; });

  // ---------- Lưu tư thế nghỉ ----------
  const rest = {};
  for (const [name, obj] of Object.entries(nodes)) {
    rest[name] = {
      p: obj.position.clone(),
      q: obj.quaternion.clone(),
      s: obj.scale.clone(),
    };
  }

  return { root, nodes, rest, mats };
}

/** Đưa toàn bộ khung về tư thế nghỉ (gọi trước mỗi lần áp pose). */
export function resetPose(nodes, rest) {
  for (const [name, obj] of Object.entries(nodes)) {
    const r = rest[name];
    obj.position.copy(r.p);
    obj.quaternion.copy(r.q);
    obj.scale.copy(r.s);
  }
}

/** Đổi màu nhanh: { body, belly, accent, leaf } (hex string). */
export function setColors(mats, colors) {
  if (colors.body) { mats.body.color.set(colors.body); }
  if (colors.belly) { mats.belly.color.set(colors.belly); }
  if (colors.accent) { mats.accent.color.set(colors.accent); }
  if (colors.leaf) { mats.leaf.color.set(colors.leaf); }
}

/** Snapshot / blend dùng khi chuyển trạng thái để không bị "giật". */
export function capturePose(nodes) {
  const snap = {};
  for (const [name, obj] of Object.entries(nodes)) {
    snap[name] = { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone() };
  }
  return snap;
}

export function blendFromSnapshot(nodes, snap, alpha) {
  for (const [name, obj] of Object.entries(nodes)) {
    const s = snap[name];
    if (!s) continue;
    obj.position.lerpVectors(s.p, obj.position, alpha);
    obj.quaternion.slerpQuaternions(s.q, obj.quaternion, alpha);
    obj.scale.lerpVectors(s.s, obj.scale, alpha);
  }
}
