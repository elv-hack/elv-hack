/**
 * 各个画面共用的字体和小工具。配色在 abyss.mjs。
 */

/** 嵌入等宽字体（子集），给出 .mono。只有用到字符的画面（片头、奇点）才嵌 */
export const baseStyle = (fonts) => `
  @font-face { font-family: 'JBM'; src: url(data:font/woff2;base64,${fonts.mono}) format('woff2'); font-weight: 100 800; }
  .mono { font-family: 'JBM', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`;

export const r1 = (n) => Math.round(n * 10) / 10;

export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** 确定性的伪随机数序列 */
export function rng(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
