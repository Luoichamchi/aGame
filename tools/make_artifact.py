# tools/make_artifact.py — Tạo file HTML để đăng lên trình xem artifact của claude.ai từ character/index.html:
# bỏ doctype/html/head/body (trình xem tự bọc), thêm token màu cho giao diện sáng/tối, tắt nút tải file.
# Dùng:  python3 tools/make_artifact.py <đường dẫn file đầu ra>
import sys, pathlib
src = pathlib.Path(__file__).resolve().parent.parent / 'character' / 'index.html'
s = src.read_text()
body = s[s.index('<canvas'):s.index('</body>')]
style = s[s.index('<style>'):s.index('</style>') + 8]
style = style.replace("""  :root {
    --bg: rgba(255,255,255,.86); --ink: #2a2c3e; --accent: #ff9a3c; --accent2: #ffc247; --line: #e6e8f0;
  }""", """  /* Bố cục: khung 3D toàn màn hình, bảng điều khiển nổi (trái trên desktop, kéo lên từ đáy trên điện thoại) */
  :root {
    --bg: rgba(255,255,255,.88); --panel-fg: #2a2c3e; --ink: #2a2c3e; --btn: #ffffff; --soft: #f6f7fb; --muted: #6b6f80;
    --accent: #ff9a3c; --accent2: #ffc247; --line: #e6e8f0; --sky: #eaf4fb;
    --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg: rgba(30,32,44,.9); --panel-fg: #eceef6; --ink: #eceef6; --btn: #2b2e3d; --soft: #262938; --muted: #a3a7b8; --line: #3a3e52; --accent2: #e0a52f; color-scheme: dark; } }
  :root[data-theme="dark"] {
    --bg: rgba(30,32,44,.9); --panel-fg: #eceef6; --ink: #eceef6; --btn: #2b2e3d; --soft: #262938; --muted: #a3a7b8; --line: #3a3e52; --accent2: #e0a52f; color-scheme: dark; }""")
reps = [
    ('html, body { margin: 0; height: 100%; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: #cdebff; }',
     'html, body { margin: 0; height: 100%; overflow: hidden; font-family: var(--font); color: var(--ink); background: var(--sky); }'),
    ('canvas#c { display: block; width: 100vw; height: 100vh; touch-action: none; }',
     'canvas#c { position: fixed; inset: 0; display: block; width: 100%; height: 100%; touch-action: none; }'),
    ('#panel h1 small { font-weight: 400; color: #777;', '#panel h1 small { font-weight: 400; color: var(--muted);'),
    ('letter-spacing: .06em; color: #888;', 'letter-spacing: .06em; color: var(--muted);'),
    ('button { font: inherit; font-size: 13px; border: 1px solid var(--line); background: #fff; color: var(--ink);',
     'button { font: inherit; font-size: 13px; border: 1px solid var(--line); background: var(--btn); color: var(--ink);'),
    ('button.on { background: var(--accent2); border-color: var(--accent); font-weight: 600; }',
     'button.on { background: var(--accent2); border-color: var(--accent); color: #2a2c3e; font-weight: 600; }\n  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }'),
    ('button kbd { font: 10px/1 ui-monospace, monospace; background: #f1f2f6; border: 1px solid #d8dbe6; border-radius: 4px; padding: 2px 4px; color: #666; }',
     'button kbd { font: 10px/1 ui-monospace, monospace; background: var(--soft); border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; color: var(--muted); }'),
    ('#hud { font-size: 13px; background: #f6f7fb;', '#hud { font-size: 13px; background: var(--soft);'),
    ('.help { font-size: 11.5px; color: #666;', '.help { font-size: 11.5px; color: var(--muted);'),
    ('.help kbd { font: 10px/1 ui-monospace, monospace; background: #f1f2f6; border: 1px solid #d8dbe6;',
     '.help kbd { font: 10px/1 ui-monospace, monospace; background: var(--soft); border: 1px solid var(--line);'),
    ('#msg { position: fixed; left: 50%; bottom: 18px;', '#msg { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px));'),
    ('#btn-toggle { display: none; position: fixed; left: 12px; top: 12px;', '#btn-toggle { display: none; position: fixed; left: 12px; top: calc(12px + env(safe-area-inset-top, 0px));'),
    ('#panel { left: 0; right: 0; top: auto; bottom: 0; width: 100%; max-height: 62vh; border-radius: 16px 16px 0 0; }',
     '#panel { left: 0; right: 0; top: auto; bottom: 0; width: 100%; max-height: 62vh; border-radius: 16px 16px 0 0; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }'),
    ('#panel { position: fixed; left: 12px; top: 12px;', '#panel { position: fixed; left: 12px; top: calc(12px + env(safe-area-inset-top, 0px)); color: var(--panel-fg);'),
]
for a, b in reps:
    assert a in style, a
    style = style.replace(a, b)
out = "<title>Nhân vật 3D</title>\n" + style + "\n<script>window.__NO_DOWNLOAD__ = true;</script>\n" + body
assert 'importmap' not in out
pathlib.Path(sys.argv[1]).write_text(out)
print('wrote', sys.argv[1], len(out), 'bytes')
