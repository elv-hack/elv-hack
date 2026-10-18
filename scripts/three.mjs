/**
 * 极简的 3D 工具：旋转和透视投影。GitHub 的 README 不能跑 JS，所有“3D”都是预先算好每一帧，交给 SVG 自己播放。
 */

export const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
export const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];

/**
 * 透视投影。相机在 (0, 0, -dist) 看向 +z，屏幕中心 (cx, cy)，焦距 f。
 * 返回 [sx, sy, depth]，depth 越大越远；在相机后面返回 null。
 */
export function project([x, y, z], { cx, cy, f, dist }) {
  const d = z + dist;
  if (d <= 0.05) return null;
  return [cx + (f * x) / d, cy - (f * y) / d, d];
}
