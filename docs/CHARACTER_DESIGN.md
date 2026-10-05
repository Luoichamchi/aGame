# Thiết kế nhân vật "Bông"

> Tên tạm. Đổi tên ở `character/index.html` (tiêu đề) và `character/js/app.js` (tên file GLB xuất ra).

## 1. Ý tưởng

| | |
|---|---|
| **Đối tượng** | Trẻ em → hình khối tròn, màu ấm, mặt to, biểu cảm rõ |
| **Hình dáng** | 2 khối cầu chồng nhau (đầu ≈ 45% chiều cao, tỉ lệ *chibi*), tay chân ngắn cục cục, không khuỷu / đầu gối |
| **Điểm nhận dạng** | Chồi lá 2 lá trên đỉnh đầu. Khi bay, chồi lá xoay như cánh quạt |
| **Phong cách render** | Toon 3 bậc sáng, bóng mềm, không texture → dễ đổi màu, nhẹ cho mobile |
| **Chiều cao** | ≈ 1.95 đơn vị (mét) tính cả chồi lá; pivot `Root` ở mặt đất giữa 2 chân |
| **Hướng nhìn** | +Z (mặt nhìn về +Z, +Y lên trên, +X là bên trái nhân vật) |

![Các trạng thái](images/states_sheet.png)

## 2. Bộ phận & tên node

Mọi bộ phận là `Object3D` có **tên duy nhất**. Tên này là "hợp đồng" giữa 3 file: `character.js` tạo, `poses.js` / `face.js` điều khiển, `export.js` bake ra GLB (track animation tham chiếu theo tên).

```
Root                      pivot mặt đất; squash & stretch, nhào lộn (roll), độ cao khi nhảy
└─ Hips                   (0, 0.40, 0) tâm xoay thân
   ├─ Body, Belly         elip thân + mảng bụng sáng
   ├─ LegL / LegR         pivot hông  → ShinL/R (capsule), FootL/R (cầu dẹt)
   ├─ ShoulderL / R       pivot vai   → ArmL/R (capsule), HandL/R (cầu)
   └─ Neck                (0, 0.62, 0) tâm gật / nghiêng đầu
      └─ Head             cầu r = 0.5, tâm ở y = 1.45
         ├─ EyeL / EyeR   → EyeballL/R, PupilL/R, ShineL/R, LidTopL/R, LidBotL/R
         ├─ BrowL / BrowR → BrowMeshL/R
         ├─ CheekL / CheekR
         ├─ Mouth         → MouthC, MouthL1 → MouthL2, MouthR1 → MouthR2, MouthOpen, Tongue
         └─ Tuft          → Stem, Prop → LeafA, LeafB
```

Hậu tố `L` = bên trái nhân vật (+X), `R` = bên phải (-X).

Kích thước chính (file `character.js`, hàm `buildCharacter`):

| Bộ phận | Hình | Kích thước |
|---|---|---|
| Body | cầu scale | bán kính (0.42, 0.40, 0.38), tâm y = 0.72 |
| Head | cầu | r = 0.50, tâm y = 1.45 |
| Eyeball | cầu | r = 0.11, tại (±0.19, 0.07, 0.42) so với tâm đầu |
| Arm | capsule | r = 0.085, dài 0.16; Hand r = 0.105 |
| Shin | capsule | r = 0.10, dài 0.16; Foot (0.13, 0.08, 0.16) |

Bảng màu mặc định (`PALETTE` trong `character.js`): thân `#FFC247`, bụng `#FFF3D1`, tay chân `#FF9A3C`, lá `#6CCB7A`, má `#FF8FA8`, con ngươi `#2A2C3E`, miệng `#7A2E3B`.

## 3. Biểu cảm

Một biểu cảm = **1 bộ tham số số học** (`face.js`, `EXPRESSIONS`). Không có morph target, không đổi mesh: mọi thứ chỉ là position / rotation / scale nên blend mượt giữa 2 biểu cảm và bake được thành animation.

| Tham số | Ý nghĩa | Dải |
|---|---|---|
| `brow` | góc lông mày: + giận (đầu trong hạ), − buồn (đầu trong nhướn) | −1 … 1 |
| `browUp` | nhướn mày | 0 … 0.1 |
| `lidTop` | mí trên nhắm bao nhiêu (âm nhẹ = trợn) | −0.15 … 1 |
| `lidBot` | mí dưới nâng bao nhiêu (≈ 0.5 là "mắt cười ^^") | 0 … 1 |
| `pupil` | cỡ con ngươi (nhỏ = sợ, to = yêu thích) | 0.4 … 1.5 |
| `curve` | độ cong miệng: + cười, − mếu | −1 … 1 |
| `open` | há miệng | 0 … 1 |
| `width` | bề rộng miệng | 0.5 … 1.3 |
| `blush` | má hồng | 0 … 1.5 |
| `wink` | nhắm riêng mắt phải | 0 … 1 |
| `tongue` | lè lưỡi | 0 … 1 |

Cơ chế đáng chú ý:

- **Mí mắt** = chỏm cầu nửa trước, xoay quanh trục X của mắt. Mép mí trên chạy từ +78° (mở) xuống −15° (nhắm); mí dưới từ −82° lên +25°. Khi mí dưới vượt lên trên tâm, mép mí cong thành hình "∩" → mắt cười.
- **Miệng** = chuỗi 5 đoạn capsule nối khớp; `curve` bẻ góc từng khớp nên độ dày đường miệng không đổi dù cười hay mếu. Khoang miệng (`MouthOpen`) là elip tối co giãn theo `open`.
- **Chớp mắt** và **liếc theo camera** là lớp phủ lúc chạy thật (`app.js`), không nằm trong preset.

14 biểu cảm có sẵn:

![Biểu cảm](images/faces_sheet.png)

Mỗi trạng thái có biểu cảm mặc định (cột `face` trong `STATES`): đứng yên → bình thường, đi → vui, chạy → tập trung, nhảy / bay → wow, lăn → cười lớn, trượt → phấn khích. Người chơi / gameplay có thể ghi đè bằng `S.manualFace`.

## 4. Trạng thái hoạt động

`poses.js` — mỗi trạng thái là hàm thuần `pose(nodes, t)`, giả định khung đang ở tư thế nghỉ. Nhờ vậy cùng một hàm dùng cho cả chạy thật và bake.

| Trạng thái | Loại | Chu kỳ / thời lượng | Tốc độ | Ý chính của chuyển động |
|---|---|---|---|---|
| `idle` Đứng yên | lặp | 2.4 s | 0 | thở (squash 2%), đầu đung đưa, lá lắc |
| `walk` Đi | lặp | 0.455 s (2.2 bước/s) | 1.7 | chân ±37°, tay ngược chân, thân nhún 3.5 cm |
| `run` Chạy | lặp | 0.3 s (3.2 bước/s) | 4.5 | chân ±57°, thân ngả trước 17°, tay dang, nhún 7 cm |
| `jump` Nhảy | 1 lần | 1.0 s | giữ đà | 0–16%: thụp xuống (squash 0.78) → 16–84%: bay parabol cao 1.3, kéo dài 1.25 lúc bật, tay giơ, chân co → 84–100%: tiếp đất bẹp 0.75 |
| `roll` Lăn | 1 lần | 0.8 s | 4.5 → 2.7 | cuộn tròn (tay chân ôm), `Root` xoay 360° quanh trục X với tâm quay = tâm thân |
| `slide` Trượt | 1 lần | 1.0 s | 5.5 → 1.0 | ngả sau 43°, hạ hông, 1 chân duỗi trước, tay vung sau, lá bạt về sau |
| `fly` Bay | lặp | 1.25 s | 3.6 | thân nằm ngang (ngả trước 75°), tay dang vỗ nhẹ, chồi lá xoay 40 rad/s, nhấp nhô 12 cm |

Quy tắc chuyển trạng thái (`app.js`):

- `idle / walk / run` quyết định mỗi frame từ input (có hướng → đi, giữ Shift → chạy).
- `jump / roll / slide` là **one-shot**: chạy hết thời lượng rồi quay về trạng thái liên tục; không ngắt được bằng one-shot khác.
- `fly` là toggle; đang bay thì không nhảy / lăn / trượt. Tắt bay → rơi xuống, chạm đất có squash tiếp đất.
- Mọi lần đổi trạng thái đều blend 0.22 s từ tư thế đang có (`capturePose` → `blendFromSnapshot`) nên không giật.
- Chuyển động ngang do `Mover` (nhóm bọc ngoài `Root`) đảm nhiệm → clip animation là *in-place*, engine tự di chuyển nhân vật.

Squash & stretch dùng `Root.scale = (1/√s, s, 1/√s)` để giữ "thể tích" → cảm giác dẻo, mềm.

## 5. Xuất sang engine

Nút **Xuất GLB** (hoặc `exportGLB()` trong `export.js`):

1. Với mỗi trạng thái: lấy mẫu pose 30 fps → `VectorKeyframeTrack` / `QuaternionKeyframeTrack` cho node nào có thay đổi.
2. Với mỗi biểu cảm: 1 clip `Face_<tên>` giữ tư thế (2 frame) để engine blend bằng layer / additive.
3. `GLTFExporter` ghi `Root` + 21 clip ra `bong.glb` (~0.9 MB).

Lưu ý khi dùng:

- `Jump` có độ cao trong clip (`Root.position.y`); nếu engine dùng physics riêng thì xoá track đó hoặc dùng root-motion.
- `Roll` xoay `Root` 360°, tốc độ ngang do engine cấp.
- Material là toon → exporter ghi thành PBR màu phẳng; muốn giữ look toon thì gán shader toon ở engine.
- Hierarchy xuất ra là nhóm lồng nhau (không có skin / bone). Muốn rig xương chuẩn thì import GLB vào Blender, dùng cây node làm khung tham chiếu.

## 6. Mở rộng tiếp

| Muốn | Sửa ở |
|---|---|
| Thêm biểu cảm | `face.js` → thêm 1 dòng trong `EXPRESSIONS`; UI và demo tự nhận |
| Thêm trạng thái (vd. bơi, ngồi) | `poses.js` → thêm vào `STATES` + hàm trong `POSES`; `app.js` thêm phím nếu cần |
| Đổi tỉ lệ / màu | `character.js` (`buildCharacter`, `PALETTE`) |
| Phụ kiện (mũ, kính) | thêm mesh con của `Head` trong `character.js`, đặt tên mới |
| Chụp lại ảnh tài liệu | `npm i playwright-core` rồi `node tools/screenshot.mjs docs/images` (cần server tĩnh ở cổng 8765) |

Tham số URL để xem tư thế tĩnh (dùng khi chỉnh số liệu): `index.html?state=jump&t=0.5&face=wow&cam=tq&lift=1&ui=0`
(`cam`: front / side / tq / face / back; `lift`: nâng camera).
