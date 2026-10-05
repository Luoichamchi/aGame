// face2d.js — Mặt "vẽ lên": vẽ mắt / mày / miệng / má bằng Canvas 2D rồi dán thành texture
// lên một chỏm cầu (FacePlate) ôm sát phía trước đầu. Dùng CHUNG bộ tham số biểu cảm của face.js.
//
// Toạ độ vẽ = góc trên mặt cầu (radian): x ngang (−1.1 … 1.1), y dọc (−0.7 … 0.9), gốc ở giữa mặt.
import * as THREE from 'three';

export const FACE2D = { W: 1024, H: 768, X0: -1.1, X1: 1.1, Y0: -0.7, Y1: 0.9 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Tạo chỏm cầu + canvas. headRadius = bán kính đầu. Trả về { mesh, draw(f, colors), texture }. */
export function createFacePlate(headRadius) {
  const canvas = document.createElement('canvas');
  canvas.width = FACE2D.W;
  canvas.height = FACE2D.H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const phiLen = FACE2D.X1 - FACE2D.X0;
  const thetaLen = FACE2D.Y1 - FACE2D.Y0;
  // Chỏm cầu: phi quanh +Z (phi = π/2 là chính diện), theta tính từ cực +Y
  const geo = new THREE.SphereGeometry(headRadius + 0.012, 64, 48,
    Math.PI / 2 + FACE2D.X0, phiLen,
    Math.PI / 2 - FACE2D.Y1, thetaLen);
  // alphaTest loại pixel trong suốt; không nhận bóng vì bóng VSM sẽ in vệt lên vùng trong suốt
  const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.02, depthWrite: false, roughness: 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'FacePlate';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;

  let lastKey = '';
  function draw(f, c) {
    const key = JSON.stringify([f, c]);
    if (key === lastKey) return;
    lastKey = key;
    drawFace(ctx, f, c);
    texture.needsUpdate = true;
  }
  return { mesh, draw, texture, canvas };
}

/** Vẽ toàn bộ khuôn mặt theo tham số f (xem face.js) và bảng màu c. */
export function drawFace(ctx, f, c) {
  const { W, H, X0, X1, Y0, Y1 } = FACE2D;
  const sx = W / (X1 - X0), sy = H / (Y1 - Y0);
  const X = (x) => (x - X0) * sx;
  const Y = (y) => (Y1 - y) * sy;
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, Math.PI * 2); };

  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Mõm kem (vẽ phẳng; mũi vẫn là khối 3D)
  ctx.fillStyle = c.belly;
  ell(0, -0.33, 0.50, 0.37);
  ctx.fill();

  // Má hồng
  const b = clamp(f.blush, 0, 1.6);
  if (b > 0.01) {
    ctx.fillStyle = c.cheek;
    ctx.globalAlpha = 0.85;
    for (const sg of [1, -1]) { ell(sg * 0.64, -0.20, 0.11 * b, 0.08 * b); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // Mắt
  const ex = 0.40, ey = 0.14, rx = 0.185, ry = 0.21;
  for (const sg of [1, -1]) {
    const cx = sg * ex, cy = ey;
    const extra = sg < 0 ? f.wink : 0;              // nháy mắt phải (−X)
    const lidTop = clamp(f.lidTop + extra, -0.15, 1);
    const lidBot = clamp(f.lidBot + extra, 0, 1);
    ctx.save();
    ell(cx, cy, rx, ry);
    ctx.clip();
    ctx.fillStyle = c.eye;
    ctx.fill();
    // Con ngươi + chấm sáng
    const ps = clamp(f.pupil, 0.35, 1.6);
    const pr = 0.15 * ps;
    const px = cx + f.lookX * 0.05, py = cy + f.lookY * 0.04;
    ctx.fillStyle = c.pupil;
    ell(px, py, pr, pr * 1.05);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ell(px - 0.05 * ps, py + 0.065 * ps, 0.05 * ps, 0.05 * ps); ctx.fill();
    ell(px + 0.05 * ps, py - 0.06 * ps, 0.022 * ps, 0.022 * ps); ctx.fill();
    // Mí mắt = 2 hình tròn lớn ép từ trên / dưới (mép trên "∪", mép dưới "∩" → mắt cười).
    // Vùng mí được XOÁ trong suốt để lộ đầu thật (không lệch tông), rồi vẽ nét mí mỏng khi mắt khép.
    const R = 0.55;
    const tilt = -sg * f.brow * 0.5;
    const dTop = (ry + R) - lidTop * (2 * ry + 0.06);
    const dBot = (ry + R) - lidBot * (2 * ry + 0.06);
    ctx.translate(X(cx), Y(cy));
    ctx.globalCompositeOperation = 'destination-out';
    ctx.rotate(tilt);
    ctx.beginPath(); ctx.ellipse(0, -dTop * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(-tilt * 1.4);
    ctx.beginPath(); ctx.ellipse(0, dBot * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // nét mí
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.028 * sx;
    const aBot = clamp((lidBot - 0.3) / 0.3, 0, 1);
    if (aBot > 0) {
      ctx.globalAlpha = aBot;
      ctx.beginPath(); ctx.ellipse(0, dBot * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.rotate(tilt * 1.4);
    const aTop = clamp((lidTop - 0.15) / 0.35, 0, 1);
    if (aTop > 0) {
      ctx.globalAlpha = aTop;
      ctx.beginPath(); ctx.ellipse(0, -dTop * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Lông mày
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 0.04 * sx;
  for (const sg of [1, -1]) {
    const bx = sg * ex, by = 0.43 + f.browUp * 1.8 - Math.abs(f.brow) * 0.02;
    const ang = -sg * f.brow * 0.6;
    const L = 0.11;
    ctx.beginPath();
    ctx.moveTo(X(bx - L * Math.cos(ang)), Y(by + L * Math.sin(ang)));
    ctx.lineTo(X(bx + L * Math.cos(ang)), Y(by - L * Math.sin(ang)));
    ctx.stroke();
  }

  // Miệng: đường môi trên (bezier), khoang miệng mở, lưỡi
  const my = -0.42;
  const w = 0.28 * clamp(f.width, 0.4, 1.4);
  const k = f.curve * 0.11;
  const op = clamp(f.open, 0, 1);
  const tg = clamp(f.tongue, 0, 1);
  const lip = (yEnd, yCtrl) => {
    ctx.beginPath();
    ctx.moveTo(X(-w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(-w / 4), Y(yCtrl), X(w / 4), Y(yCtrl), X(w / 2), Y(yEnd));
  };
  const yEnd = my + k, yCtrl = my - k;
  if (op > 0.02) {
    const depth = op * 0.24;
    ctx.fillStyle = c.mouth;
    ctx.beginPath();
    ctx.moveTo(X(-w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(-w / 4), Y(yCtrl), X(w / 4), Y(yCtrl), X(w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(w / 4), Y(yCtrl - depth), X(-w / 4), Y(yCtrl - depth), X(-w / 2), Y(yEnd));
    ctx.closePath();
    ctx.fill();
    // lưỡi trong miệng
    ctx.save(); ctx.clip();
    ctx.fillStyle = c.tongue;
    ell(0, yCtrl - depth * 0.9, 0.10, 0.06 + depth * 0.25);
    ctx.fill();
    ctx.restore();
  }
  if (tg > 0.02) {                                  // lè lưỡi ra ngoài
    ctx.fillStyle = c.tongue;
    ell(0.02, yCtrl - op * 0.2 - tg * 0.06, 0.075 * tg, 0.085 * tg);
    ctx.fill();
    ctx.strokeStyle = c.mouth;
    ctx.lineWidth = 0.012 * sx;
    ctx.stroke();
  }
  ctx.strokeStyle = c.mouth;
  ctx.lineWidth = 0.034 * sx;
  lip(yEnd, yCtrl);
  ctx.stroke();
}
