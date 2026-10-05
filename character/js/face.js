// face.js — Hệ biểu cảm. Mọi biểu cảm = 1 bộ tham số số học (0..1 hoặc -1..1),
// áp lên các node mặt chỉ bằng position / rotation / scale → có thể bake thành animation GLB.
//
//  brow   : góc lông mày  (+ = giận (đầu trong hạ xuống), - = buồn (đầu trong nhướn lên))
//  browUp : nhướn mày (dịch lên)  0 .. 0.1
//  lidTop : mí trên nhắm bao nhiêu  0 (mở to) .. 1 (nhắm)   (âm nhẹ = mở trừng)
//  lidBot : mí dưới nâng bao nhiêu  0 .. 1  (0.3 ≈ mắt cười)
//  pupil  : cỡ con ngươi (1 = thường, <1 = sợ/ngạc nhiên, >1 = yêu thích)
//  curve  : độ cong miệng (+1 cười, -1 mếu)
//  open   : há miệng 0 .. 1
//  width  : bề rộng miệng (1 = thường)
//  blush  : má hồng 0 .. 1.5
//  wink   : nhắm riêng mắt phải 0 .. 1
//  tongue : lè lưỡi 0 .. 1
//  lookX / lookY : hướng nhìn của con ngươi (-1 .. 1), chỉ dùng lúc chạy thật

export const FACE_DEFAULT = {
  brow: 0, browUp: 0, lidTop: 0.05, lidBot: 0, pupil: 1,
  curve: 0.3, open: 0, width: 1, blush: 0.5, wink: 0, tongue: 0, lookX: 0, lookY: 0,
};

const E = (label, p) => ({ label, params: { ...FACE_DEFAULT, ...p } });

export const EXPRESSIONS = {
  neutral:   E('Bình thường', {}),
  happy:     E('Vui',         { browUp: 0.02, lidTop: 0.08, lidBot: 0.55, curve: 1, open: 0.15, blush: 1 }),
  laugh:     E('Cười lớn',    { browUp: 0.03, lidTop: 1, lidBot: 0.8, curve: 1, open: 0.9, width: 1.2, blush: 1.2 }),
  sad:       E('Buồn',        { brow: -0.55, browUp: 0.03, lidTop: 0.45, curve: -0.8, open: 0, blush: 0.2 }),
  angry:     E('Giận',        { brow: 0.6, browUp: -0.04, lidTop: 0.4, curve: -0.6, open: 0.3, width: 0.8, blush: 0.6 }),
  surprised: E('Ngạc nhiên',  { browUp: 0.08, lidTop: -0.1, pupil: 0.6, curve: 0.1, open: 0.9, width: 0.55, blush: 0.4 }),
  scared:    E('Sợ',          { brow: -0.45, browUp: 0.07, lidTop: -0.05, pupil: 0.45, curve: -0.5, open: 0.5, width: 0.8, blush: 0.1 }),
  sleepy:    E('Buồn ngủ',    { lidTop: 0.72, curve: 0.1, open: 0.15, blush: 0.3 }),
  love:      E('Yêu thích',   { browUp: 0.02, lidTop: 0.1, lidBot: 0.6, pupil: 1.45, curve: 1, open: 0.1, blush: 1.5 }),
  wink:      E('Nháy mắt',    { lidBot: 0.45, curve: 0.9, open: 0.2, wink: 1, blush: 1 }),
  silly:     E('Lè lưỡi',     { brow: -0.2, browUp: 0.03, lidTop: 0.15, wink: 0.9, curve: 0.7, open: 0.6, tongue: 1, blush: 0.9 }),
  focus:     E('Tập trung',   { brow: 0.3, lidTop: 0.25, curve: 0.55, open: 0.3, width: 0.9, blush: 0.6 }),
  excited:   E('Phấn khích',  { brow: 0.15, browUp: 0.03, lidTop: 0, lidBot: 0.45, curve: 1, open: 0.8, width: 1.1, blush: 1.2 }),
  wow:       E('Wow!',        { browUp: 0.06, lidTop: -0.08, pupil: 0.85, curve: 0.85, open: 0.5, width: 0.9, blush: 1 }),
};

export const FACE_KEYS = Object.keys(FACE_DEFAULT);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const D2R = Math.PI / 180;

/** Áp bộ tham số f lên các node mặt. Gọi SAU khi áp pose cơ thể. */
export function applyFace(n, f) {
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const extraClose = side === 'R' ? f.wink : 0;
    const cTop = clamp(f.lidTop + extraClose, -0.15, 1);
    const cBot = clamp(f.lidBot + extraClose, 0, 1);
    // Mí = chỏm cầu nửa trước (rộng 90° mỗi bên). Mép mí trên đi từ +78° (mở) xuống -15° (nhắm),
    // mép mí dưới từ -82° (mở) lên +25° (mắt cười "^^"). Góc xoay = 90° + mép (vì chỏm rộng 90°).
    const edgeTop = 78 - 93 * cTop;
    const edgeBot = -82 + 107 * cBot;
    n['LidTop' + side].rotation.set(-(90 + edgeTop) * D2R, 0, sg * f.brow * 0.5, 'ZXY');
    n['LidBot' + side].rotation.set((90 - edgeBot) * D2R, 0, -sg * f.brow * 0.2, 'ZXY');

    const brow = n['Brow' + side];
    brow.rotation.z = sg * f.brow * 0.7;
    brow.position.y = brow.userData.baseY + f.browUp - Math.abs(f.brow) * 0.02;

    const pupil = n['Pupil' + side];
    const ps = Math.max(0.2, f.pupil);
    pupil.scale.setScalar(ps);
    pupil.position.z = pupil.userData.baseZ + (1 - ps) * 0.045;   // con ngươi nhỏ thì đẩy ra để không lún vào tròng
    pupil.position.x = f.lookX * 0.035;
    pupil.position.y = f.lookY * 0.03;
    const sb = n['Shine' + side].userData.base;
    n['Shine' + side].position.x = sb.x + f.lookX * 0.03;
    n['Shine' + side].position.y = sb.y + f.lookY * 0.025;

    const cheek = n['Cheek' + side];
    const b = 0.001 + Math.max(0, f.blush);
    const cb = cheek.userData.base;
    cheek.scale.set(cb.x * b, cb.y * b, cb.z * Math.min(1, b));
  }

  // Miệng
  const a = f.curve * 0.45;
  n.Mouth.scale.x = Math.max(0.3, f.width);
  n.MouthL1.rotation.z = -a;
  n.MouthL2.rotation.z = -a;
  n.MouthR1.rotation.z = a;
  n.MouthR2.rotation.z = a;
  const op = clamp(f.open, 0, 1);
  n.MouthOpen.scale.set(0.001 + 0.05 * Math.min(1, op * 4), 0.001 + op * 0.055, 0.001 + 0.03 * Math.min(1, op * 4));
  n.MouthOpen.position.y = -0.015 - op * 0.03;
  const tg = clamp(f.tongue, 0, 1);
  n.Tongue.scale.set(0.001 + 0.032 * tg, 0.001 + 0.018 * tg, 0.001 + 0.03 * tg);
  n.Tongue.position.y = -0.03 - op * 0.045 - tg * 0.02;
}

export function lerpFace(cur, target, k) {
  for (const key of FACE_KEYS) {
    cur[key] += (target[key] - cur[key]) * k;
  }
  return cur;
}
