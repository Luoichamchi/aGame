// face.js — Bảng biểu cảm. Mọi biểu cảm = 1 bộ tham số số học (0..1 hoặc -1..1);
// face2d.js đọc bộ tham số này để vẽ mặt.
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

export function lerpFace(cur, target, k) {
  for (const key of FACE_KEYS) {
    cur[key] += (target[key] - cur[key]) * k;
  }
  return cur;
}
