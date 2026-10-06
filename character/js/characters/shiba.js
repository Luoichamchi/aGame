// characters/shiba.js — Nhân vật shiba béo, đi 4 chân: dựng hình + bố cục mặt + bộ pose.
// Dáng lấy theo tranh cách điệu: đầu là một hình tròn to ở phía trước, thân là khối tròn dài phía sau,
// bốn chân ngắn, tai nhọn, đuôi cuộn trên lưng. Mặt vẽ 2D trên chỏm cầu của đầu.
import * as THREE from '../../vendor/three.module.js';
import { makeRig, captureRest } from '../character.js';
import { createFacePlate } from '../face2d.js';
import { squash, sm, lerp, easeInOut, clamp01, TAU, STATES } from '../poses.js';

export const PALETTE = {
  body:   '#E89B55', // lông cam shiba
  belly:  '#FFF4E4', // lông sáng: mõm, ngực, bụng, chấm mày, bàn chân
  accent: '#4B3328', // mũi, nét mí
  cheek:  '#F7A6B5', // má hồng + tai trong
  eye:    '#FFFFFF',
  pupil:  '#1E1B22',
  mouth:  '#6E2F34',
  tongue: '#FF7B9C',
};

const HEAD_R = 0.50;
const HEAD = new THREE.Vector3(0, 0.98, 0.42);   // tâm đầu (world)

// Bố cục mặt: mắt nhỏ, đen gần hết; mask lông sáng che mõm + hai má; chấm mày sáng kiểu shiba
export const FACE_LAYOUT = {
  muzzle: null,
  mask(ctx, h, c) {
    ctx.fillStyle = c.belly;
    h.ell(0, -0.22, 0.66, 0.50); ctx.fill();          // mõm + hai má + quanh mắt (urajiro)
  },
  eye: { x: 0.36, y: 0.08, rx: 0.115, ry: 0.135, pupil: 0.105, lidFill: 'belly' },
  brow: { type: 'dot', x: 0.36, y: 0.42, len: 0.075, width: 0.045 },
  blush: { x: 0.56, y: -0.14, rx: 0.10, ry: 0.07 },
  mouth: { y: -0.36, w: 0.20, k: 0.08 },
};

export function build() {
  const { nodes, G, M, E, sphere, capsule, clay } = makeRig();
  const mats = {
    body: clay(PALETTE.body),
    belly: clay(PALETTE.belly),
    accent: clay(PALETTE.accent, 0.8),
    cheek: clay(PALETTE.cheek),
    eye: clay(PALETTE.eye),
    pupil: clay(PALETTE.pupil),
    mouth: clay(PALETTE.mouth),
    tongue: clay(PALETTE.tongue),
  };

  const root = new THREE.Group();
  root.name = 'Root';
  nodes.Root = root;

  // Hips = tâm thân. Thân là khối tròn dài theo trục Z (trước = +Z)
  const hips = G('Hips', root, 0, 0.62, 0);
  E('Body', hips, mats.body, 0, 0, -0.08, 0.44, 0.42, 0.52);
  E('Chest', hips, mats.belly, 0, -0.06, 0.40, 0.30, 0.27, 0.24);     // ngực sáng dưới đầu
  E('Belly', hips, mats.belly, 0, -0.27, -0.08, 0.31, 0.18, 0.40);     // bụng sáng

  // Bốn chân ngắn, bàn chân sáng màu ("đi tất")
  for (const [name, x, z] of [['FL', 0.20, 0.36], ['FR', -0.20, 0.36], ['BL', 0.23, -0.38], ['BR', -0.23, -0.38]]) {
    const leg = G('Leg' + name, hips, x, -0.20, z);
    M('Shin' + name, leg, capsule(0.10, 0.14), mats.body, 0, -0.17, 0);
    E('Paw' + name, leg, mats.belly, 0, -0.31, 0.02, 0.115, 0.10, 0.125);
  }

  // Đuôi cuộn trên lưng: một cung torus, đầu đuôi sáng
  const tail = G('Tail', hips, 0, 0.36, -0.54);
  const tailMesh = M('TailMesh', tail, new THREE.TorusGeometry(0.17, 0.085, 14, 32, Math.PI * 1.45), mats.body, 0, 0.02, 0);
  tailMesh.rotation.set(0, Math.PI / 2, -0.4);
  E('TailTip', tailMesh, mats.belly, 0.17 * Math.cos(Math.PI * 1.45), 0.17 * Math.sin(Math.PI * 1.45), 0, 0.09, 0.09, 0.09);

  // Cổ = tâm đầu → Head xoay quanh tâm nên mặt (chỏm cầu) luôn ôm sát
  const neck = G('Neck', hips, HEAD.x, HEAD.y - 0.62, HEAD.z);
  const head = G('Head', neck, 0, 0, 0);
  M('HeadMesh', head, sphere(HEAD_R, 56, 40), mats.body);

  // Tai nhọn + tai trong hồng
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const ear = G('Ear' + side, head, 0.27 * sg, 0.37, -0.04);
    ear.rotation.z = -0.38 * sg;
    ear.rotation.x = -0.12;
    const em = M('EarMesh' + side, ear, new THREE.ConeGeometry(0.15, 0.30, 28), mats.body, 0, 0.12, 0);
    em.scale.set(1, 1, 0.55);
    const ei = M('EarInner' + side, ear, new THREE.ConeGeometry(0.085, 0.19, 24), mats.cheek, 0, 0.09, 0.05);
    ei.scale.set(1, 1, 0.4);
    ei.castShadow = false;
  }

  // Mũi (khối) + mặt vẽ 2D trên chỏm cầu đầu
  E('Nose', head, mats.accent, 0, -0.08, 0.49, 0.075, 0.055, 0.05);
  const profile = [];
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI / 2 + (i / 48) * Math.PI;
    profile.push(new THREE.Vector2(HEAD_R * Math.cos(a) + 1e-4, HEAD_R * Math.sin(a)));
  }
  const plate = createFacePlate(profile, HEAD_R, FACE_LAYOUT);
  head.add(plate.mesh);
  nodes.FacePlate = plate.mesh;

  return { root, nodes, rest: captureRest(nodes), mats, plate };
}

// Chân: rotation.x > 0 = chân vung ra sau (như gấu). Trước = FL/FR, sau = BL/BR.
const legs = (n, fl, fr, bl, br) => {
  n.LegFL.rotation.x = fl; n.LegFR.rotation.x = fr; n.LegBL.rotation.x = bl; n.LegBR.rotation.x = br;
};

export const POSES = {
  idle(n, t) {
    const b = Math.sin(TAU * t / 2.4);
    squash(n, 1 + 0.015 * b);
    n.Tail.rotation.z = 0.25 * Math.sin(t * 3.1);                 // vẫy đuôi
    n.Neck.rotation.z = 0.05 * Math.sin(t * 0.9);
    n.Neck.rotation.y = 0.12 * Math.sin(t * 0.5 + 1);              // nhìn quanh
    n.Neck.rotation.x = 0.03 * b;
    n.EarL.rotation.z += 0.05 * Math.sin(t * 2.7);
    n.EarR.rotation.z -= 0.05 * Math.sin(t * 2.7 + 0.8);
  },

  // Đi: nhịp chéo (trước trái + sau phải cùng pha)
  walk(n, t) {
    const th = TAU * 2.0 * t;
    const s = Math.sin(th);
    legs(n, 0.55 * s, -0.55 * s, -0.55 * s, 0.55 * s);
    n.Hips.position.y += 0.025 * (0.5 - 0.5 * Math.cos(2 * th));
    n.Hips.rotation.z = 0.04 * s;
    n.Hips.rotation.y = 0.04 * s;
    n.Neck.rotation.x = 0.05 * Math.sin(2 * th);
    n.Neck.rotation.z = -0.04 * s;
    n.Tail.rotation.z = 0.35 * s;
    n.EarL.rotation.x += 0.08 * Math.sin(2 * th);
    n.EarR.rotation.x += 0.08 * Math.sin(2 * th);
    squash(n, 1 + 0.02 * Math.cos(2 * th));
  },

  // Chạy: phi nước đại — hai chân trước cùng pha, hai chân sau lệch pha
  run(n, t) {
    const th = TAU * 3.0 * t;
    const f = Math.sin(th), bk = Math.sin(th + 2.6);
    legs(n, 1.0 * f, 1.0 * f, 0.95 * bk, 0.95 * bk);
    n.Hips.position.y += 0.08 * (0.5 - 0.5 * Math.cos(th));
    n.Hips.rotation.x = 0.14 * Math.sin(th + 0.5);
    n.Neck.rotation.x = -0.12 - 0.08 * Math.sin(th + 0.5);
    n.EarL.rotation.x += -0.5;
    n.EarR.rotation.x += -0.5;
    n.Tail.rotation.x = -0.45;
    n.Tail.rotation.z = 0.15 * f;
    squash(n, 1 + 0.05 * Math.cos(th));
  },

  // Nhảy: thụp xuống → bật lên (ngẩng mũi) → tiếp đất bẹp
  jump(n, t) {
    const A = 0.16, L = 0.84;
    if (t < A) {
      const k = sm(t / A);
      squash(n, 1 - 0.18 * k);
      n.Hips.position.y -= 0.12 * k;
      legs(n, 0.5 * k, 0.5 * k, -0.5 * k, -0.5 * k);
      n.Neck.rotation.x = 0.15 * k;
      n.EarL.rotation.x += -0.3 * k; n.EarR.rotation.x += -0.3 * k;
    } else if (t < L) {
      const p = (t - A) / (L - A);
      n.Root.position.y = 1.2 * 4 * p * (1 - p);
      const st = Math.pow(Math.abs(Math.cos(Math.PI * p)), 1.5) * (p < 0.5 ? 0.2 : 0.1);
      squash(n, 1 + st);
      const tuck = Math.sin(Math.PI * p);
      n.Hips.rotation.x = lerp(-0.35, 0.3, p);
      legs(n, -0.9 * tuck, -0.9 * tuck, 0.9 * tuck, 0.9 * tuck);
      n.Neck.rotation.x = -0.2 * tuck;
      n.EarL.rotation.x += -0.6 * tuck; n.EarR.rotation.x += -0.6 * tuck;
      n.Tail.rotation.x = -0.4 * tuck;
    } else {
      const k = (t - L) / (1 - L);
      const b = Math.sin(Math.PI * k);
      squash(n, 1 - 0.22 * b);
      n.Hips.position.y -= 0.1 * b;
      legs(n, 0.4 * b, 0.4 * b, -0.4 * b, -0.4 * b);
      n.Neck.rotation.x = 0.12 * b;
    }
  },

  // Lăn: lộn vòng ngang (quanh trục Z) với tâm quay = tâm thân, chân dạng ra
  roll(n, t) {
    const D = STATES.roll.duration;
    const p = clamp01(t / D);
    const tuck = sm(p / 0.2) * sm((1 - p) / 0.2);
    const th = TAU * easeInOut(p);
    const cy = 0.62;
    n.Root.rotation.z = th;
    n.Root.position.x = cy * Math.sin(th);
    n.Root.position.y = cy - cy * Math.cos(th);
    n.Root.scale.setScalar(1 - 0.05 * tuck);
    n.LegFL.rotation.z = 0.7 * tuck; n.LegBL.rotation.z = 0.7 * tuck;
    n.LegFR.rotation.z = -0.7 * tuck; n.LegBR.rotation.z = -0.7 * tuck;
    legs(n, -0.5 * tuck, -0.5 * tuck, 0.5 * tuck, 0.5 * tuck);
    n.Neck.rotation.x = 0.35 * tuck;
    n.EarL.rotation.x += -0.5 * tuck; n.EarR.rotation.x += -0.5 * tuck;
  },

  // Trượt bụng: hạ thấp, chân trước duỗi tới, chân sau duỗi lui, ngẩng đầu, tai bạt ra sau
  slide(n, t) {
    const D = STATES.slide.duration;
    const p = clamp01(t / D);
    const k = sm(p / 0.15) * sm((1 - p) / 0.25);
    n.Hips.position.y -= 0.22 * k;
    n.Hips.rotation.x = -0.12 * k;
    legs(n, -1.5 * k, -1.5 * k, 1.4 * k, 1.4 * k);
    n.Neck.rotation.x = -0.35 * k;
    n.EarL.rotation.x += -0.6 * k; n.EarR.rotation.x += -0.6 * k;
    n.Tail.rotation.x = -0.3 * k;
    squash(n, 1 - 0.05 * k);
  },

  // Bay: kiểu siêu nhân — chân trước duỗi tới, chân sau duỗi lui, tai vỗ như cánh, đuôi xoay như cánh quạt
  fly(n, t) {
    const bob = Math.sin(TAU * t / 1.25);
    n.Root.position.y = 0.12 * bob;
    n.Hips.rotation.x = -0.1 + 0.04 * bob;
    const flap = Math.sin(TAU * 3 * t);
    legs(n, -1.6, -1.6, 1.3, 1.3);
    n.EarL.rotation.z += 0.45 * flap;
    n.EarR.rotation.z -= 0.45 * flap;
    n.Neck.rotation.x = -0.2;
    n.Tail.rotation.y = t * 30;
    squash(n, 1 + 0.02 * bob);
  },
};

export const shiba = {
  id: 'shiba',
  label: 'Shiba béo',
  focusY: 0.72,
  headY: HEAD.y,
  colors: [['body', 'Lông'], ['belly', 'Lông sáng'], ['accent', 'Mũi'], ['cheek', 'Má / tai']],
  PALETTE, build, POSES,
};
