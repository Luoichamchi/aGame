// face2d.js — Mặt "vẽ lên": vẽ mõm / mắt / mày / miệng / má bằng Canvas 2D rồi dán thành texture
// lên tấm FacePlate ôm sát phía trước thân. Dùng CHUNG bộ tham số biểu cảm của face.js.
//
// Toạ độ vẽ = góc quanh tâm đầu (radian): x ngang (−1.1 … 1.1), y dọc (−0.7 … 0.9) tính theo chiều dài cung / bán kính đầu.
import * as THREE from '../vendor/three.module.js';

export const FACE2D = { W: 1024, H: 768, X0: -1.1, X1: 1.1, Y0: -0.7, Y1: 0.9 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Tạo tấm mặt + canvas. `profile` = mảng điểm (r, y) của thân, toạ độ gốc ở TÂM ĐẦU, đi từ dưới lên;
 * headRadius để quy đổi chiều dài cung → "góc" (toạ độ vẽ). Tấm mặt = lathe một phần, lệch ra 1.2 cm
 * khỏi thân nên bám sát từ trán xuống mõm dù thân dưới phình to hơn cầu.
 * Trả về { mesh, draw(f, colors), texture }.
 */
export function createFacePlate(profile, headRadius, layout) {
  const canvas = document.createElement('canvas');
  canvas.width = FACE2D.W;
  canvas.height = FACE2D.H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // Chiều dài cung tính từ xích đạo (y = 0) → "góc" a = s / headRadius
  const pts = profile.map((v) => new THREE.Vector2(v.x, v.y));
  const eq = pts.reduce((best, v, i) => (Math.abs(v.y) < Math.abs(pts[best].y) ? i : best), 0);
  const arc = new Array(pts.length).fill(0);
  for (let i = eq + 1; i < pts.length; i++) arc[i] = arc[i - 1] + pts[i].distanceTo(pts[i - 1]);
  for (let i = eq - 1; i >= 0; i--) arc[i] = arc[i + 1] - pts[i].distanceTo(pts[i + 1]);
  const at = (a) => {                                   // nội suy điểm + pháp tuyến tại góc a
    const sTarget = a * headRadius;
    let i = 0;
    while (i < pts.length - 2 && arc[i + 1] < sTarget) i++;
    const t = clamp((sTarget - arc[i]) / (arc[i + 1] - arc[i] || 1), 0, 1);
    const pnt = pts[i].clone().lerp(pts[i + 1], t);
    const tan = pts[i + 1].clone().sub(pts[i]).normalize();
    const nrm = new THREE.Vector2(tan.y, -tan.x);        // hướng ra ngoài
    return pnt.addScaledVector(nrm, 0.012);
  };
  const N = 48;
  const platePts = [];
  for (let j = 0; j < N; j++) platePts.push(at(FACE2D.Y0 + (j / (N - 1)) * (FACE2D.Y1 - FACE2D.Y0)));
  const geo = new THREE.LatheGeometry(platePts, 64, FACE2D.X0, FACE2D.X1 - FACE2D.X0);

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
    drawFace(ctx, f, c, layout);
    texture.needsUpdate = true;
  }
  return { mesh, draw, texture, canvas };
}

/**
 * Vẽ toàn bộ khuôn mặt theo tham số f (xem face.js), bảng màu c và bố cục L:
 *  L.muzzle {x,y,rx,ry} | null      mảng mõm sáng màu
 *  L.mask   (ctx, h, c) => void      vẽ thêm mảng lông tuỳ ý (h = {X, Y, ell, sx, sy})
 *  L.eye    {x,y,rx,ry,pupil,lidFill} vị trí / cỡ mắt, bán kính con ngươi; lidFill = khoá màu tô mí
 *                                    (vd 'belly' khi mắt nằm trên mảng lông sáng), bỏ trống = xoá trong suốt lộ đầu
 *  L.brow   {type:'line'|'dot', x,y,len,width} | null
 *  L.blush  {x,y,rx,ry}
 *  L.mouth  {y,w,k}                  vị trí, bề rộng, độ cong tối đa
 */
export function drawFace(ctx, f, c, L) {
  const { W, H, X0, X1, Y0, Y1 } = FACE2D;
  const sx = W / (X1 - X0), sy = H / (Y1 - Y0);
  const X = (x) => (x - X0) * sx;
  const Y = (y) => (Y1 - y) * sy;
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, Math.PI * 2); };

  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Mảng lông sáng: mõm và/hoặc mask tuỳ nhân vật
  ctx.fillStyle = c.belly;
  if (L.mask) L.mask(ctx, { X, Y, ell, sx, sy }, c);
  if (L.muzzle) { ell(L.muzzle.x, L.muzzle.y, L.muzzle.rx, L.muzzle.ry); ctx.fill(); }

  // Má hồng
  const b = clamp(f.blush, 0, 1.6);
  if (b > 0.01) {
    ctx.fillStyle = c.cheek;
    ctx.globalAlpha = 0.85;
    for (const sg of [1, -1]) { ell(sg * L.blush.x, L.blush.y, L.blush.rx * b, L.blush.ry * b); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // Mắt
  const { x: ex, y: ey, rx, ry } = L.eye;
  const pk = L.eye.pupil / 0.15;                    // hệ số cỡ so với mắt gấu
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
    const pr = L.eye.pupil * ps;
    const px = cx + f.lookX * 0.05 * pk, py = cy + f.lookY * 0.04 * pk;
    ctx.fillStyle = c.pupil;
    ell(px, py, pr, pr * 1.05);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ell(px - 0.05 * ps * pk, py + 0.065 * ps * pk, 0.05 * ps * pk, 0.05 * ps * pk); ctx.fill();
    ell(px + 0.05 * ps * pk, py - 0.06 * ps * pk, 0.022 * ps * pk, 0.022 * ps * pk); ctx.fill();
    // Mí mắt = 2 hình tròn lớn ép từ trên / dưới (mép trên "∪", mép dưới "∩" → mắt cười).
    // Vùng mí được XOÁ trong suốt để lộ đầu thật (không lệch tông), rồi vẽ nét mí mỏng khi mắt khép.
    const R = 0.55;
    const tilt = -sg * f.brow * 0.5;
    const dTop = (ry + R) - lidTop * (2 * ry + 0.06);
    const dBot = (ry + R) - lidBot * (2 * ry + 0.06);
    ctx.translate(X(cx), Y(cy));
    if (L.eye.lidFill) ctx.fillStyle = c[L.eye.lidFill];
    else ctx.globalCompositeOperation = 'destination-out';
    ctx.rotate(tilt);
    ctx.beginPath(); ctx.ellipse(0, -dTop * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(-tilt * 1.4);
    ctx.beginPath(); ctx.ellipse(0, dBot * sy, R * sx, R * sy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // nét mí
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.028 * sx * Math.max(0.6, Math.sqrt(pk));
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

  // Lông mày: nét ('line') hoặc chấm lông sáng ('dot', kiểu shiba)
  if (L.brow) {
    for (const sg of [1, -1]) {
      const bx = sg * L.brow.x, by = L.brow.y + f.browUp * 1.8 - Math.abs(f.brow) * 0.02;
      const ang = -sg * f.brow * 0.6;
      if (L.brow.type === 'dot') {
        ctx.save();
        ctx.translate(X(bx), Y(by));
        ctx.rotate(ang);
        ctx.fillStyle = c.belly;
        ctx.beginPath(); ctx.ellipse(0, 0, L.brow.len * sx, L.brow.width * sy, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = L.brow.width * sx;
        const Lh = L.brow.len;
        ctx.beginPath();
        ctx.moveTo(X(bx - Lh * Math.cos(ang)), Y(by + Lh * Math.sin(ang)));
        ctx.lineTo(X(bx + Lh * Math.cos(ang)), Y(by - Lh * Math.sin(ang)));
        ctx.stroke();
      }
    }
  }

  // Miệng: đường môi trên (bezier), khoang miệng mở, lưỡi
  const my = L.mouth.y;
  const w = L.mouth.w * clamp(f.width, 0.4, 1.4);
  const k = f.curve * L.mouth.k;
  const op = clamp(f.open, 0, 1);
  const tg = clamp(f.tongue, 0, 1);
  const mk = L.mouth.w / 0.28;                        // hệ số cỡ miệng so với gấu
  const lip = (yEnd, yCtrl) => {
    ctx.beginPath();
    ctx.moveTo(X(-w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(-w / 4), Y(yCtrl), X(w / 4), Y(yCtrl), X(w / 2), Y(yEnd));
  };
  const yEnd = my + k, yCtrl = my - k;
  if (op > 0.02) {
    const depth = op * 0.24 * mk;
    ctx.fillStyle = c.mouth;
    ctx.beginPath();
    ctx.moveTo(X(-w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(-w / 4), Y(yCtrl), X(w / 4), Y(yCtrl), X(w / 2), Y(yEnd));
    ctx.bezierCurveTo(X(w / 4), Y(yCtrl - depth), X(-w / 4), Y(yCtrl - depth), X(-w / 2), Y(yEnd));
    ctx.closePath();
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = c.tongue;
    ell(0, yCtrl - depth * 0.9, 0.10 * mk, (0.06 + depth * 0.25) * mk);
    ctx.fill();
    ctx.restore();
  }
  if (tg > 0.02) {                                  // lè lưỡi ra ngoài
    ctx.fillStyle = c.tongue;
    ell(0.02 * mk, yCtrl - op * 0.2 * mk - tg * 0.06 * mk, 0.075 * tg * mk, 0.085 * tg * mk);
    ctx.fill();
    ctx.strokeStyle = c.mouth;
    ctx.lineWidth = 0.012 * sx;
    ctx.stroke();
  }
  ctx.strokeStyle = c.mouth;
  ctx.lineWidth = 0.034 * sx * Math.max(0.7, mk);
  lip(yEnd, yCtrl);
  ctx.stroke();
}
