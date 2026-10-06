// character.js — Phần DÙNG CHUNG cho mọi nhân vật: helper dựng khung, vật liệu, tư thế nghỉ, blend.
// Mỗi nhân vật nằm trong characters/<tên>.js và export { id, label, focusY, colors, PALETTE, build, POSES }.
import * as THREE from 'three';

/** Tạo bộ helper dựng khung. Mọi node tạo qua G/M/E đều được ghi vào `nodes` theo tên (phải duy nhất). */
export function makeRig() {
  const nodes = {};
  // Vật liệu "đất sét" mờ: không bậc sáng, không viền, ăn ánh sáng môi trường
  const clay = (hex, roughness = 0.9) => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0 });
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
  return { nodes, G, M, E, SPHERE, sphere, capsule, clay };
}

/** Lưu tư thế nghỉ (position / quaternion / scale) của mọi node. */
export function captureRest(nodes) {
  const rest = {};
  for (const [name, obj] of Object.entries(nodes)) {
    rest[name] = { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone() };
  }
  return rest;
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

/** Đổi màu nhanh: { body, belly, accent, leaf, ... } (hex string) — chỉ đổi những khoá có trong mats. */
export function setColors(mats, colors) {
  for (const [k, v] of Object.entries(colors)) if (mats[k] && v) mats[k].color.set(v);
}

/** Snapshot / blend dùng khi chuyển trạng thái để không bị "giật". */
export function capturePose(nodes) {
  return captureRest(nodes);
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
