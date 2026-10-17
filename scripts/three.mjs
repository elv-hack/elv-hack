/**
 * 极简的 3D 工具：旋转、透视投影，以及把多帧投影结果写成 SVG 的逐帧动画（SMIL values）。
 * GitHub 的 README 不能跑 JS，所以所有“3D”都是预先算好每一帧，交给 SVG 自己播放。
 */
import { r1 } from './lib.mjs';

export const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
export const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
export const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/**
 * 透视投影。相机在 (0, 0, -dist) 看向 +z，屏幕中心 (cx, cy)，焦距 f。
 * 返回 [sx, sy, depth]，depth 越大越远；在相机后面返回 null。
 */
export function project([x, y, z], { cx, cy, f, dist }) {
  const d = z + dist;
  if (d <= 0.05) return null;
  return [cx + (f * x) / d, cy - (f * y) / d, d];
}

export const pathOf = (pts, close = false) =>
  pts.length ? `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}${close ? 'Z' : ''}` : '';

/** 把一组帧（每帧一条 path）写成循环播放的 <animate> */
export const morph = (frames, dur, attr = 'd') =>
  `<animate attributeName="${attr}" values="${frames.join(';')}" dur="${dur}s" repeatCount="indefinite" calcMode="linear"/>`;

/** 一组帧里的数值写成离散动画（比如每帧的透明度） */
export const values = (list, dur, attr) =>
  `<animate attributeName="${attr}" values="${list.map((v) => r1(v)).join(';')}" dur="${dur}s" repeatCount="indefinite" calcMode="linear"/>`;
