// export.js — Bake các pose thủ tục thành keyframe rồi xuất GLB (glTF binary).
// File GLB chứa: mesh + hierarchy + 7 clip: Idle, Walk, Run, Jump, Roll, Slide, Fly. Mặt là texture trên FacePlate.
// Dùng được trong Unity / Godot / Blender / three.js. Clip Walk/Run/Fly là "in-place" (engine tự di chuyển).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/GLTFExporter.js';
import { resetPose } from './character.js';
import { STATES } from './poses.js';

const FPS = 30;

function sampleClip(name, nodes, rest, duration, applyFrame) {
  const frames = Math.max(2, Math.round(duration * FPS) + 1);
  const times = [];
  const data = {};
  for (const n of Object.keys(nodes)) data[n] = { p: [], q: [], s: [] };

  for (let i = 0; i < frames; i++) {
    const t = Math.min(duration, i / FPS);
    times.push(t);
    resetPose(nodes, rest);
    applyFrame(t);
    for (const [n, obj] of Object.entries(nodes)) {
      data[n].p.push(obj.position.x, obj.position.y, obj.position.z);
      data[n].q.push(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
      data[n].s.push(obj.scale.x, obj.scale.y, obj.scale.z);
    }
  }

  // Chỉ giữ track của node có thay đổi so với tư thế nghỉ → file nhỏ
  const varies = (arr, stride, ref) => {
    for (let i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i] - ref[i % stride]) > 1e-5) return true;
    }
    return false;
  };
  const tracks = [];
  for (const [n, d] of Object.entries(data)) {
    const r = rest[n];
    if (varies(d.p, 3, [r.p.x, r.p.y, r.p.z])) tracks.push(new THREE.VectorKeyframeTrack(`${n}.position`, times, d.p));
    if (varies(d.q, 4, [r.q.x, r.q.y, r.q.z, r.q.w])) tracks.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, d.q));
    if (varies(d.s, 3, [r.s.x, r.s.y, r.s.z])) tracks.push(new THREE.VectorKeyframeTrack(`${n}.scale`, times, d.s));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

/** Tạo danh sách AnimationClip từ POSES + EXPRESSIONS. */
export function bakeClips(nodes, rest, POSES) {
  const clips = [];
  for (const [key, st] of Object.entries(STATES)) {
    const dur = st.loop ? st.period : st.duration;
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    clips.push(sampleClip(name, nodes, rest, dur, (t) => POSES[key](nodes, t)));
  }
  resetPose(nodes, rest);
  return clips;
}

/** Xuất GLB và tải về. Trả về Promise<số byte>. */
export function exportGLB(root, nodes, rest, POSES, filename = 'bong.glb') {
  const clips = bakeClips(nodes, rest, POSES);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      root,
      (result) => {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve(blob.size);
      },
      (err) => reject(err),
      { binary: true, animations: clips, trs: true },
    );
  });
}
