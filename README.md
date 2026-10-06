# aGame

Game cho trẻ em (đang thiết kế). Hiện tại repo chứa **hai nhân vật 3D**: shiba béo (4 chân) và gấu "Bông" (2 chân). Prototype chạy ngay trong trình duyệt, mỗi nhân vật có đủ 7 trạng thái hoạt động và 14 biểu cảm, xuất được file GLB để dùng trong Unity / Godot / Blender.

![Shiba và Bông](docs/images/hero.png)

## Chạy thử (1 lệnh)

```bash
python3 -m http.server 8765
# rồi mở: http://localhost:8765/character/
```

Không cần cài gì thêm: Three.js đã nằm sẵn trong `character/vendor/`.

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên | Đi |
| giữ `Shift` | Chạy |
| `Space` | Nhảy |
| `R` | Lăn |
| `C` | Trượt |
| `F` | Bật / tắt bay |
| chuột kéo / lăn | Xoay / zoom camera |

Bảng bên trái có nút chọn nhân vật, từng hành động, từng biểu cảm, đổi màu, **Demo tự động** (nhân vật tự diễn hết mọi thứ) và **Xuất GLB**. Mở thẳng một nhân vật: `?char=shiba` hoặc `?char=bear`.

## Cấu trúc

```
character/
  index.html              giao diện + import map
  js/characters/shiba.js  SHIBA: dựng hình + bố cục mặt + 7 pose 4 chân
  js/characters/bear.js   GẤU:   dựng hình + bố cục mặt + 7 pose 2 chân
  js/character.js         helper dùng chung: dựng khung, vật liệu clay, tư thế nghỉ, blend
  js/face.js              bảng 14 biểu cảm = bộ tham số số học (dùng chung)
  js/face2d.js            vẽ mặt bằng canvas theo bố cục của từng nhân vật → texture dán sát đầu
  js/poses.js             bảng 7 trạng thái (tên, thời lượng, tốc độ) + helper squash/lerp
  js/app.js               scene, điều khiển, máy trạng thái, demo, UI, chọn nhân vật
  js/export.js            bake pose → keyframe → GLB (7 animation clip)
  vendor/           three.module.js, OrbitControls.js, GLTFExporter.js, RoomEnvironment.js (r170, MIT)
docs/
  CHARACTER_DESIGN.md   tài liệu thiết kế nhân vật (đọc cái này trước khi sửa)
  images/               ảnh render các trạng thái / biểu cảm
tools/
  screenshot.mjs        chụp ảnh tĩnh mọi trạng thái bằng Chromium headless (tham số thứ 3 = tên nhân vật)
```

## Xem tiếp

→ [docs/CHARACTER_DESIGN.md](docs/CHARACTER_DESIGN.md)
