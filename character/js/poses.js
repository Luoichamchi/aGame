// poses.js — Bảng trạng thái dùng chung + helper. Bộ pose cụ thể nằm trong characters/<tên>.js:
// mỗi pose là hàm thuần (nodes, t) → sửa transform, GIẢ ĐỊNH khung đã ở tư thế nghỉ (resetPose),
// nên cùng một hàm dùng được cho chạy thật (app.js) và bake thành animation (export.js).
//
// Quy ước trục: nhân vật nhìn về +Z, +Y lên trên, +X là bên TRÁI của nhân vật.
//  - Leg.rotation.x  > 0 : chân vung ra sau
//  - Shoulder.rotation.x > 0 : tay vung ra sau
//  - Hips.rotation.x > 0 : thân ngả về trước

export const TAU = Math.PI * 2;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };     // smoothstep
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

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
