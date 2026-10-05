// character.js — Dựng mô hình nhân vật "Bông" từ các khối cơ bản (sphere / capsule).
// Mọi bộ phận đều là Object3D có TÊN DUY NHẤT (xem bảng tên trong docs/CHARACTER_DESIGN.md).
// Tên này được dùng ở 3 nơi: poses.js (animation), face.js (biểu cảm) và export.js (xuất GLB).
import * as THREE from 'three';

export const PALETTE = {
  body:   '#FFC247', // màu thân chính
  belly:  '#FFF3D1', // bụng
  accent: '#FF9A3C', // tay / chân
  leaf:   '#6CCB7A', // chồi lá trên đầu
  cheek:  '#FF8FA8', // má hồng
  eye:    '#FFFFFF',
  pupil:  '#2A2C3E',
  mouth:  '#7A2E3B',
  tongue: '#FF7B9C',
};

// Gradient 3 bậc cho MeshToonMaterial → nhìn "hoạt hình", ít chi tiết, hợp trẻ em.
function makeGradientMap() {
  const data = new Uint8Array([
    110, 110, 110, 255,
    190, 190, 190, 255,
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
    eye: new THREE.MeshToonMaterial({ color: PALETTE.eye, gradientMap: grad, emissive: '#555555' }),
    pupil: toon(PALETTE.pupil),
    shine: new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
    mouth: toon(PALETTE.mouth),
    tongue: toon(PALETTE.tongue),
  };

  // Hình học dùng chung
  const SPHERE = new THREE.SphereGeometry(1, 32, 24);
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

  // ---------- Khung xương (hierarchy) ----------
  const root = new THREE.Group();
  root.name = 'Root';
  nodes.Root = root;

  const hips = G('Hips', root, 0, 0.40, 0);

  // Thân: elip tròn trịa, bụng sáng màu phía trước
  const body = M('Body', hips, SPHERE, mats.body, 0, 0.32, 0);
  body.scale.set(0.42, 0.40, 0.38);
  const belly = M('Belly', hips, SPHERE, mats.belly, 0, 0.27, 0.21);
  belly.scale.set(0.27, 0.25, 0.19);

  // Tay + chân: đối xứng L (+X) / R (-X)
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    // Chân
    const leg = G('Leg' + side, hips, 0.17 * sg, 0.0, 0);
    M('Shin' + side, leg, capsule(0.10, 0.16), mats.accent, 0, -0.14, 0);
    const foot = M('Foot' + side, leg, SPHERE, mats.accent, 0, -0.32, 0.04);
    foot.scale.set(0.13, 0.08, 0.16);

    // Tay
    const sh = G('Shoulder' + side, hips, 0.38 * sg, 0.42, 0.02);
    sh.rotation.z = 0.35 * sg; // tư thế nghỉ: tay hơi dang ra
    M('Arm' + side, sh, capsule(0.085, 0.16), mats.accent, 0, -0.13, 0);
    M('Hand' + side, sh, sphere(0.105), mats.accent, 0, -0.30, 0);
  }

  // Cổ → Đầu (đầu to ≈ 45% chiều cao: tỉ lệ chibi)
  const neck = G('Neck', hips, 0, 0.62, 0);
  const head = M('Head', neck, sphere(0.5, 48, 32), mats.body, 0, 0.43, 0);

  // ---------- Khuôn mặt (con của Head, toạ độ quanh tâm đầu) ----------
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const eye = G('Eye' + side, head, 0.19 * sg, 0.07, 0.42);
    M('Eyeball' + side, eye, sphere(0.11), mats.eye);
    M('Pupil' + side, eye, sphere(0.05, 16, 12), mats.pupil, 0, 0, 0.075);
    const shine = M('Shine' + side, eye, sphere(0.02, 8, 6), mats.shine, 0.022 * sg, 0.03, 0.105);
    shine.castShadow = false;
    const lt = M('LidTop' + side, eye, lidGeo(0.140), mats.body);
    const lb = M('LidBot' + side, eye, lidGeo(0.136), mats.body);
    lt.rotation.order = 'ZXY';
    lb.rotation.order = 'ZXY';

    // Lông mày: capsule nằm ngang, bám theo mặt cầu
    const brow = G('Brow' + side, head, 0.19 * sg, 0.25, 0.41);
    brow.rotation.x = -0.45;
    const browMesh = M('BrowMesh' + side, brow, capsule(0.022, 0.10), mats.pupil);
    browMesh.rotation.z = Math.PI / 2;

    // Má hồng
    const cheek = M('Cheek' + side, head, SPHERE, mats.cheek, 0.34 * sg, -0.08, 0.35);
    cheek.rotation.y = 0.75 * sg;
    cheek.scale.set(0.07, 0.05, 0.02);
  }

  // Miệng: chuỗi 5 đoạn capsule, bẻ góc theo "curve" → cười / mếu mà độ dày không đổi
  const mouth = G('Mouth', head, 0, -0.15, 0.455);
  mouth.rotation.x = 0.32;
  const seg = () => { const g = capsule(0.02, 0.05); return g; };
  const segMesh = (name, parent) => {
    const m = M(name, parent, seg(), mats.mouth);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  segMesh('MouthC', mouth);
  const ml1 = G('MouthL1', mouth, -0.025, 0, 0);
  segMesh('MouthL1Mesh', ml1).position.x = -0.025;
  const ml2 = G('MouthL2', ml1, -0.05, 0, 0);
  segMesh('MouthL2Mesh', ml2).position.x = -0.025;
  const mr1 = G('MouthR1', mouth, 0.025, 0, 0);
  segMesh('MouthR1Mesh', mr1).position.x = 0.025;
  const mr2 = G('MouthR2', mr1, 0.05, 0, 0);
  segMesh('MouthR2Mesh', mr2).position.x = 0.025;
  // Khoang miệng (mở) + lưỡi
  const open = M('MouthOpen', mouth, SPHERE, mats.mouth, 0, -0.02, -0.005);
  open.scale.set(0.06, 0.01, 0.03);
  const tongue = M('Tongue', mouth, SPHERE, mats.tongue, 0, -0.03, 0.01);
  tongue.scale.set(0.001, 0.001, 0.001);

  // Chồi lá trên đầu: khi bay thì xoay như cánh quạt
  const tuft = G('Tuft', head, 0, 0.49, 0);
  tuft.rotation.x = -0.15;
  M('Stem', tuft, capsule(0.022, 0.10), mats.leaf, 0, 0.06, 0);
  const prop = G('Prop', tuft, 0, 0.13, 0);
  const leafA = M('LeafA', prop, SPHERE, mats.leaf, 0.09, 0.01, 0);
  leafA.scale.set(0.10, 0.03, 0.05);
  leafA.rotation.z = 0.35;
  const leafB = M('LeafB', prop, SPHERE, mats.leaf, -0.09, 0.01, 0);
  leafB.scale.set(0.10, 0.03, 0.05);
  leafB.rotation.z = -0.35;

  // Chi tiết mặt nhỏ: không đổ bóng để hốc mắt / miệng không bị tối
  head.traverse((o) => { if (o.isMesh && o !== head) o.castShadow = false; });

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

/** Đổi màu nhanh: { body, belly, accent } (hex string). */
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
