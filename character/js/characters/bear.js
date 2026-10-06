// characters/bear.js — Nhân vật "Bông" (gấu béo, đứng 2 chân): dựng hình + bố cục mặt + bộ pose.
import * as THREE from 'three';
import { makeRig, captureRest } from '../character.js';
import { createFacePlate } from '../face2d.js';
import { squash, sm, lerp, easeInOut, clamp01, TAU, STATES } from '../poses.js';

export const PALETTE = {
  body:   '#EBA863', // lông chính (mật ong sáng)
  belly:  '#FFF1DB', // bụng / mõm / tai trong (kem)
  accent: '#6E4530', // tay, chân, đầu đuôi, mũi (nâu)
  leaf:   '#6BD45E', // lá trên đầu
  cheek:  '#FF9DB4', // má hồng
  eye:    '#FFFFFF',
  pupil:  '#1E1B22',
  mouth:  '#6E2F34',
  tongue: '#FF7B9C',
};

// Bố cục mặt (toạ độ góc quanh tâm đầu, radian) — xem face2d.js
export const FACE_LAYOUT = {
  muzzle: { x: 0, y: -0.24, rx: 0.50, ry: 0.35 },
  eye: { x: 0.40, y: 0.21, rx: 0.185, ry: 0.21, pupil: 0.15 },
  brow: { type: 'line', x: 0.40, y: 0.50, len: 0.11, width: 0.04 },
  blush: { x: 0.64, y: -0.12, rx: 0.11, ry: 0.08 },
  mouth: { y: -0.33, w: 0.28, k: 0.11 },
};

/**
 * Tạo nhân vật. Trả về:
 *  - root  : Group gốc (pivot ở mặt đất, giữa 2 chân)
 *  - nodes : { tên → Object3D } để animation / biểu cảm / export tra cứu
 *  - rest  : tư thế nghỉ (position / quaternion / scale) của từng node
 *  - mats  : vật liệu, để đổi màu lúc chạy
 */
export function build() {
  const { nodes, G, M, E, SPHERE, sphere, capsule, clay } = makeRig();
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


  // ---------- Khung xương (hierarchy) ----------
  const root = new THREE.Group();
  root.name = 'Root';
  nodes.Root = root;

  const hips = G('Hips', root, 0, 0.45, 0);
  const HEAD_R = 0.52;
  const HEAD_Y = 1.15;                 // tâm đầu (world)

  // Thân + đầu = MỘT khối trứng xoay tròn. Nửa trên là mặt cầu bán kính HEAD_R quanh tâm đầu,
  // phía dưới phình ra thành bụng rồi thu lại ở đáy. Profile (r, y) tính theo world, đi từ dưới lên.
  let profile;
  {
    const top = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI / 2 - (i / 12) * (Math.PI / 2);
      top.push(new THREE.Vector3(HEAD_R * Math.cos(a), HEAD_Y + HEAD_R * Math.sin(a), 0));
    }
    const belly = [[0.565, 0.98], [0.61, 0.78], [0.62, 0.58], [0.585, 0.38], [0.49, 0.20], [0.32, 0.09], [0.0, 0.06]];
    const curve = new THREE.CatmullRomCurve3([top[top.length - 1], ...belly.map(([r, y]) => new THREE.Vector3(r, y, 0))], false, 'centripetal');
    const lower = curve.getPoints(60).slice(1);
    profile = [...top, ...lower].reverse().map((v) => new THREE.Vector2(v.x, v.y));
    M('Body', hips, new THREE.LatheGeometry(profile.map((v) => new THREE.Vector2(v.x, v.y - 0.45)), 96), mats.body);
  }
  E('Belly', hips, mats.belly, 0, 0.08, 0.44, 0.34, 0.29, 0.20);

  // Đuôi: một bầu dục tròn trịa phía sau, đầu đuôi màu đậm
  const tail = G('Tail', hips, 0, 0.08, -0.50);
  tail.rotation.x = 0.35;
  E('TailMesh', tail, mats.body, 0, 0.22, 0, 0.19, 0.26, 0.16);
  E('TailTip', tail, mats.accent, 0, 0.40, 0, 0.10, 0.09, 0.09);

  // Tay + chân: đối xứng L (+X) / R (-X)
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    // Chân: rất ngắn, bàn chân chỉ lòi ra dưới thân
    const leg = G('Leg' + side, hips, 0.21 * sg, -0.10, 0.03);
    M('Shin' + side, leg, capsule(0.10, 0.08), mats.accent, 0, -0.16, 0);
    E('Foot' + side, leg, mats.accent, 0, -0.27, 0.08, 0.14, 0.08, 0.17);

    // Tay: dang ra hai bên, hơi chúc xuống
    const sh = G('Shoulder' + side, hips, 0.52 * sg, 0.42, 0.12);
    sh.rotation.z = 1.0 * sg;
    sh.rotation.x = -0.15;
    M('Arm' + side, sh, capsule(0.095, 0.14), mats.accent, 0, -0.12, 0);
    M('Hand' + side, sh, sphere(0.115), mats.accent, 0, -0.27, 0);
  }

  // Mặt + mũi gắn CỐ ĐỊNH vào thân (một khối, kiểu Fall Guys). FaceAnchor đặt ở tâm đầu.
  const faceAnchor = G('FaceAnchor', hips, 0, HEAD_Y - 0.45, 0);
  E('Nose', faceAnchor, mats.accent, 0, 0.0, 0.545, 0.075, 0.052, 0.05);
  const plate = createFacePlate(profile.map((v) => new THREE.Vector2(v.x, v.y - HEAD_Y)), HEAD_R, FACE_LAYOUT);
  faceAnchor.add(plate.mesh);
  nodes.FacePlate = plate.mesh;

  // Cổ = pivot ở TÂM đầu: chỉ tai và lá xoay khi "gật / nghiêng đầu"
  const neck = G('Neck', hips, 0, HEAD_Y - 0.45, 0);
  const head = G('Head', neck, 0, 0, 0);

  // Tai tròn + tai trong kem
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const ear = G('Ear' + side, head, 0.37 * sg, 0.40, -0.04);
    M('EarMesh' + side, ear, sphere(0.15), mats.body);
    E('EarInner' + side, ear, mats.belly, 0, 0, 0.08, 0.085, 0.085, 0.05);
  }

  // Lá trên đầu: một lá to + một lá nhỏ; khi bay thì "Prop" xoay như cánh quạt
  const tuft = G('Tuft', head, 0, 0.50, 0.02);
  tuft.rotation.x = -0.15;
  M('Stem', tuft, capsule(0.018, 0.06), mats.leaf, 0, 0.03, 0);
  const prop = G('Prop', tuft, 0, 0.07, 0);
  const leafA = E('LeafA', prop, mats.leaf, 0.13, 0.02, 0, 0.17, 0.03, 0.085);
  leafA.rotation.z = 0.25;
  const leafB = E('LeafB', prop, mats.leaf, -0.07, 0.0, 0, 0.08, 0.02, 0.045);
  leafB.rotation.z = -0.3;


  return { root, nodes, rest: captureRest(nodes), mats, plate };
}


export const POSES = {
  idle(n, t) {
    const b = Math.sin(TAU * t / 2.4);           // nhịp thở
    squash(n, 1 + 0.02 * b);
    n.Hips.position.y += 0.01 * b;
    n.Neck.rotation.z = 0.04 * Math.sin(t * 0.9);
    n.Neck.rotation.x = 0.02 * Math.sin(t * 0.7 + 1);
    n.ShoulderL.rotation.x += 0.05 * Math.sin(t * 1.3);
    n.ShoulderR.rotation.x += 0.05 * Math.sin(t * 1.3 + 0.4);
    n.Tuft.rotation.x = -0.15 + 0.1 * Math.sin(t * 2);
    n.Tuft.rotation.z = 0.08 * Math.sin(t * 1.4);
    n.Tail.rotation.z = 0.12 * Math.sin(t * 2.6);
  },

  walk(n, t) {
    const th = TAU * 2.2 * t;
    const s = Math.sin(th);
    n.LegL.rotation.x = 0.65 * s;
    n.LegR.rotation.x = -0.65 * s;
    n.FootL.rotation.x = -0.25 * s;
    n.FootR.rotation.x = 0.25 * s;
    n.ShoulderL.rotation.set(-0.55 * s, 0, 0.7);
    n.ShoulderR.rotation.set(0.55 * s, 0, -0.7);
    n.Hips.position.y += 0.035 * (0.5 - 0.5 * Math.cos(2 * th));
    n.Hips.rotation.x = 0.08;
    n.Hips.rotation.z = 0.06 * s;
    n.Hips.rotation.y = -0.08 * s;
    n.Neck.rotation.x = -0.06;
    n.Neck.rotation.z = -0.05 * s;
    n.Tuft.rotation.x = -0.15 + 0.15 * Math.sin(2 * th + 1);
    n.Tail.rotation.z = 0.25 * s;
    squash(n, 1 + 0.03 * Math.cos(2 * th));
  },

  run(n, t) {
    n.ShoulderL.rotation.y = n.ShoulderR.rotation.y = 0;
    const th = TAU * 3.2 * t;
    const s = Math.sin(th);
    n.LegL.rotation.x = 1.0 * s;
    n.LegR.rotation.x = -1.0 * s;
    n.FootL.rotation.x = -0.4 * s;
    n.FootR.rotation.x = 0.4 * s;
    n.ShoulderL.rotation.x = -0.9 * s;
    n.ShoulderR.rotation.x = 0.9 * s;
    n.ShoulderL.rotation.z = 0.85;
    n.ShoulderR.rotation.z = -0.85;
    n.Hips.position.y += 0.07 * (0.5 - 0.5 * Math.cos(2 * th));
    n.Hips.rotation.x = 0.30;
    n.Hips.rotation.z = 0.05 * s;
    n.Hips.rotation.y = -0.12 * s;
    n.Neck.rotation.x = -0.25;
    n.Neck.rotation.z = -0.04 * s;
    n.Tuft.rotation.x = -0.6 + 0.2 * Math.sin(2 * th);
    squash(n, 1 + 0.06 * Math.cos(2 * th));
  },

  // Nhảy: chuẩn bị (ngồi thụp) → bật lên (kéo dài) → bay → tiếp đất (bẹp xuống)
  jump(n, t) {
    const A = 0.16, L = 0.84;
    n.ShoulderL.rotation.y = n.ShoulderR.rotation.y = 0;
    if (t < A) {
      const k = sm(t / A);
      squash(n, 1 - 0.22 * k);
      n.Hips.position.y -= 0.06 * k;
      n.ShoulderL.rotation.x = 0.9 * k;
      n.ShoulderR.rotation.x = 0.9 * k;
      n.Neck.rotation.x = 0.2 * k;
      n.Tuft.rotation.x = -0.15 + 0.3 * k;
    } else if (t < L) {
      const p = (t - A) / (L - A);
      n.Root.position.y = 1.3 * 4 * p * (1 - p);
      const st = Math.pow(Math.abs(Math.cos(Math.PI * p)), 1.5) * (p < 0.5 ? 0.25 : 0.12);
      squash(n, 1 + st);
      const k = sm(p / 0.25);                              // tay giơ lên theo chiều ngang (không che mặt)
      n.ShoulderL.rotation.set(lerp(0.9, -0.3, k), 0, lerp(1.0, 2.5, k));
      n.ShoulderR.rotation.set(lerp(0.9, -0.3, k), 0, -lerp(1.0, 2.5, k));
      const tuck = Math.sin(Math.PI * p);
      n.LegL.rotation.x = -1.0 * tuck;
      n.LegR.rotation.x = -1.0 * tuck;
      n.LegL.rotation.z = 0.3 * tuck;
      n.LegR.rotation.z = -0.3 * tuck;
      n.Neck.rotation.x = -0.25 * tuck;
      n.Tuft.scale.y = 1 + 0.3 * tuck;
      n.Tuft.rotation.x = -0.15 - 0.3 * tuck;
    } else {
      const k = (t - L) / (1 - L);
      const b = Math.sin(Math.PI * k);
      squash(n, 1 - 0.25 * b);
      n.Hips.position.y -= 0.06 * b;
      n.ShoulderL.rotation.x = -0.8 * b;
      n.ShoulderR.rotation.x = -0.8 * b;
      n.Neck.rotation.x = 0.15 * b;
    }
  },

  // Lăn: cuộn tròn rồi nhào lộn 360° quanh trục X (tâm quay = tâm thân, không phải mặt đất)
  roll(n, t) {
    n.ShoulderL.rotation.y = n.ShoulderR.rotation.y = 0;
    const D = STATES.roll.duration;
    const p = clamp01(t / D);
    const tuck = sm(p / 0.2) * sm((1 - p) / 0.2);
    const th = TAU * easeInOut(p);
    const cy = 0.75;
    n.Root.rotation.x = th;
    n.Root.position.y = cy - cy * Math.cos(th);
    n.Root.position.z = -cy * Math.sin(th);
    n.Root.scale.setScalar(1 - 0.08 * tuck);
    n.Hips.rotation.x = 0.5 * tuck;
    n.Neck.rotation.x = 0.9 * tuck;
    n.ShoulderL.rotation.x = -1.8 * tuck;
    n.ShoulderR.rotation.x = -1.8 * tuck;
    n.ShoulderL.rotation.z = 0.35 + 0.6 * tuck;
    n.ShoulderR.rotation.z = -(0.35 + 0.6 * tuck);
    n.LegL.rotation.x = -1.3 * tuck;
    n.LegR.rotation.x = -1.3 * tuck;
    n.Tuft.rotation.x = -0.15 + 0.5 * tuck;
  },

  // Trượt: ngả người ra sau, một chân duỗi trước, tay vung sau
  slide(n, t) {
    n.ShoulderL.rotation.y = n.ShoulderR.rotation.y = 0;
    const D = STATES.slide.duration;
    const p = clamp01(t / D);
    const k = sm(p / 0.15) * sm((1 - p) / 0.25);
    n.Hips.rotation.x = -0.75 * k;
    n.Hips.position.y -= 0.12 * k;
    n.LegL.rotation.x = -1.4 * k;
    n.LegR.rotation.x = -0.6 * k;
    n.LegR.rotation.z = -0.3 * k;
    n.ShoulderL.rotation.x = 1.0 * k;
    n.ShoulderR.rotation.x = 1.3 * k;
    n.ShoulderL.rotation.z = 0.35 + 0.5 * k;
    n.ShoulderR.rotation.z = -(0.35 + 0.5 * k);
    n.Neck.rotation.x = -0.55 * k;
    n.Tuft.rotation.x = -0.15 - 0.8 * k;
    squash(n, 1 - 0.06 * k);
  },

  // Bay: nằm sấp kiểu siêu nhân, tay dang như cánh, chồi lá xoay như cánh quạt
  fly(n, t) {
    n.ShoulderL.rotation.y = n.ShoulderR.rotation.y = 0;
    const bob = Math.sin(TAU * t / 1.25);
    n.Root.position.y = 0.12 * bob;
    n.Hips.rotation.x = 0.7 + 0.05 * bob;
    n.Hips.position.y += 0.3;
    const flap = Math.sin(TAU * 2 * t);
    n.ShoulderL.rotation.z = 1.7 + 0.3 * flap;
    n.ShoulderR.rotation.z = -(1.7 + 0.3 * flap);
    n.ShoulderL.rotation.x = -0.2;
    n.ShoulderR.rotation.x = -0.2;
    n.LegL.rotation.x = 0.15 + 0.12 * Math.sin(TAU * 2 * t);
    n.LegR.rotation.x = 0.15 + 0.12 * Math.sin(TAU * 2 * t + 1);
    n.Neck.rotation.x = -0.3;
    n.Tuft.rotation.x = 0;
    n.Prop.rotation.y = t * 40;
    squash(n, 1 + 0.03 * bob);
  },
};

export const bear = {
  id: 'bear',
  label: 'Gấu Bông',
  focusY: 0.9,                 // tâm nhìn của camera
  headY: 1.15,
  colors: [['body', 'Lông'], ['belly', 'Bụng'], ['accent', 'Tay chân'], ['leaf', 'Lá']],
  PALETTE, build, POSES,
};
