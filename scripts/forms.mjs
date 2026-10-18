/**
 * 旋转的点阵形体（伪 3D）。
 *
 * 思路：绕竖轴旋转的物体上，每一圈水平环都只是在自己的高度上打转。
 * 一圈环 = “俯视图里匀速转动的平面曲线”，再按倾角竖向压扁、平移到自己的高度。
 * 所以每圈环只需要一个 CSS 旋转动画（整圈点一起转），几百个点也很省，而且转得完全平滑。
 * 远近感：每圈环套一个上淡下浓的遮罩（看的时候略微俯视，环的上半圈在远处）。
 */
import { r1 } from './lib.mjs';

/**
 * rings: [{ y, pts: [[x, z], ...], accent?: Set<index>, dim?: Set<index> }]，y 向上为正。
 * 返回 { defs, body }；整组以 (0, 0) 为中心。
 */
export function spinForm({ uid, rings, tilt = 0.6, dur = 30, dot = 1.8, colors, enter = true }) {
  const squash = Math.sin(tilt);
  const lift = Math.cos(tilt);
  const defs = `<linearGradient id="${uid}-depth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="${uid}-m" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${uid}-depth)"/></mask>`;
  const body = rings
    .map((ring, k) => {
      const lines = (ring.lines ?? [])
        .map(
          (ln) =>
            `<path d="${ln.d}" fill="none" stroke="${ln.lit ? (ln.accent ? colors.accent : colors.ink) : colors.faint}" stroke-width="${ln.lit ? 1.2 : 0.8}"${ln.lit ? '' : ' stroke-dasharray="1.5 3.5"'} vector-effect="non-scaling-stroke" stroke-linecap="round"/>`,
        )
        .join('');
      const dots = (ring.pts ?? [])
        .map(([x, z], i) => {
          const accent = ring.accent?.has(i);
          const dim = ring.dim?.has(i);
          const fill = accent ? colors.accent : dim ? colors.faint : colors.ink;
          return `<circle cx="${r1(x)}" cy="${r1(z)}" r="${accent ? dot * 1.25 : dot}" fill="${fill}"${dim ? ' opacity="0.55"' : ''}/>`;
        })
        .join('');
      // 外面再包一层专门做入场动画，避免 CSS transform 覆盖掉 transform 属性
      return `<g class="${enter ? 'ringIn' : ''}" style="--d:${r1(k * 0.06)}s"><g transform="translate(0 ${r1(-ring.y * lift)})"><g mask="url(#${uid}-m)"><g transform="scale(1 ${r1(squash * 1000) / 1000})">
        <g class="spin" style="animation-duration:${dur}s">${lines}${dots}</g></g></g></g></g>`;
    })
    .join('');
  return { defs, body: `<g>${body}</g>` };
}

export const FORM_CSS = `
  .spin { animation: spin linear infinite; }
  .ringIn { animation: rise 1.6s cubic-bezier(0.2, 0.7, 0.1, 1) var(--d) both; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes rise { from { opacity: 0; transform: translateY(18px); } }`;
