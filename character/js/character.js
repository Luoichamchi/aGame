// character.js — Dựng mô hình "Gấu béo" từ các khối cơ bản (sphere / capsule / cone).
// Mọi bộ phận đều là Object3D có TÊN DUY NHẤT (xem bảng tên trong docs/CHARACTER_DESIGN.md).
// Tên này được dùng ở 3 nơi: poses.js (animation), face.js (biểu cảm) và export.js (xuất GLB).
import * as THREE from 'three';
import { createFacePlate } from './face2d.js';

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

/**
 * Tạo nhân vật. Trả về:
 *  - root  : Group gốc (pivot ở mặt đất, giữa 2 chân)
 *  - nodes : { tên → Object3D } để animation / biểu cảm / export tra cứu
 *  - rest  : tư thế nghỉ (position / quaternion / scale) của từng node
 *  - mats  : vật liệu, để đổi màu lúc chạy
 */
export function buildCharacter() {
  const nodes = {};
  // Vật liệu "đất sét" mờ: không bậc sáng, không viền, ăn ánh sáng môi trường
  const clay = (hex, roughness = 0.9) => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0 });
  const mats = {
    body: clay(PALETTE.body),
    belly: clay(PALETTE.belly),
    accent: clay(PALETTE.accent, 0.8),
    leaf: clay(PALETTE.leaf, 0.6),
    cheek: clay(PALETTE.cheek),
    eye: clay(PALETTE.eye),
    pupil: clay(PALETTE.pupil),
    mouth: clay(PALETTE.mouth),
    tongue: clay(PALETTE.tongue),
  };

  // Hình học dùng chung
  const SPHERE = new THREE.SphereGeometry(1, 48, 32);
  const sphere = (r, w = 40, h = 28) => new THREE.SphereGeometry(r, w, h);
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 8, 24);

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

  // Đuôi: một bầu dục tròn trịa phía sau, đầu đuôi màu đậm
  const tail = G('Tail', hips, 0, 0.12, -0.50);
  tail.rotation.x = 0.35;
  E('TailMesh', tail, mats.body, 0, 0.22, 0, 0.20, 0.28, 0.17);
  E('TailTip', tail, mats.accent, 0, 0.42, 0, 0.11, 0.10, 0.10);

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

  // Mũi (khối). Mõm, mắt, mày, miệng, má được VẼ 2D trên FacePlate (face2d.js)
  E('Nose', head, mats.accent, 0, -0.06, 0.545, 0.075, 0.052, 0.05);

  // Lá trên đầu: một lá to + một lá nhỏ; khi bay thì "Prop" xoay như cánh quạt
  const tuft = G('Tuft', head, 0, 0.50, 0.02);
  tuft.rotation.x = -0.15;
  M('Stem', tuft, capsule(0.018, 0.06), mats.leaf, 0, 0.03, 0);
  const prop = G('Prop', tuft, 0, 0.07, 0);
  const leafA = E('LeafA', prop, mats.leaf, 0.13, 0.02, 0, 0.17, 0.03, 0.085);
  leafA.rotation.z = 0.25;
  const leafB = E('LeafB', prop, mats.leaf, -0.07, 0.0, 0, 0.08, 0.02, 0.045);
  leafB.rotation.z = -0.3;

  // Mặt 2D "vẽ lên": chỏm cầu dán texture canvas, ôm sát đầu (face2d.js)
  const plate = createFacePlate(0.52);
  head.add(plate.mesh);
  nodes.FacePlate = plate.mesh;

  // ---------- Lưu tư thế nghỉ ----------
  const rest = {};
  for (const [name, obj] of Object.entries(nodes)) {
    rest[name] = {
      p: obj.position.clone(),
      q: obj.quaternion.clone(),
      s: obj.scale.clone(),
    };
  }

  return { root, nodes, rest, mats, plate };
}

/** Bảng màu hiện tại dạng chuỗi CSS, để vẽ mặt 2D. */
export function currentColors(mats) {
  const hex = (m) => '#' + m.color.getHexString();
  return { skin: hex(mats.body), belly: hex(mats.belly), accent: hex(mats.accent), cheek: hex(mats.cheek), eye: hex(mats.eye), pupil: hex(mats.pupil), mouth: hex(mats.mouth), tongue: hex(mats.tongue) };
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
