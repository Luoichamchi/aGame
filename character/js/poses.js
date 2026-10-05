// poses.js — Các trạng thái "hoạt động" của nhân vật.
// Mỗi pose là hàm thuần: (nodes, t) → sửa transform, GIẢ ĐỊNH khung đã ở tư thế nghỉ (resetPose).
// Nhờ vậy cùng một hàm dùng được cho: chạy thật (app.js) và bake thành animation (export.js).
//
// Quy ước trục: nhân vật nhìn về +Z, +Y lên trên, +X là bên TRÁI của nhân vật.
//  - Leg.rotation.x  > 0 : chân vung ra sau
//  - Shoulder.rotation.x > 0 : tay vung ra sau
//  - Hips.rotation.x > 0 : thân ngả về trước

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };     // smoothstep
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Squash & stretch quanh pivot mặt đất, giữ nguyên "thể tích". */
export function squash(n, s) {
  const r = 1 / Math.sqrt(s);
  n.Root.scale.set(r, s, r);
}

export const STATES = {
  idle:  { label: 'Đứng yên', key: '',      loop: true,  period: 2.4,      face: 'neutral' },
  walk:  { label: 'Đi',       key: 'W',     loop: true,  period: 1 / 2.2,  face: 'happy',   speed: 1.7 },
  run:   { label: 'Chạy',     key: 'Shift', loop: true,  period: 1 / 3.2,  face: 'focus',   speed: 4.5 },
  jump:  { label: 'Nhảy',     key: 'Space', loop: false, duration: 1.0,    face: 'wow' },
  roll:  { label: 'Lăn',      key: 'R',     loop: false, duration: 0.8,    face: 'laugh',   speed: 4.5 },
  slide: { label: 'Trượt',    key: 'C',     loop: false, duration: 1.0,    face: 'excited', speed: 5.5 },
  fly:   { label: 'Bay',      key: 'F',     loop: true,  period: 1.25,     face: 'wow',     speed: 3.6 },
};

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
