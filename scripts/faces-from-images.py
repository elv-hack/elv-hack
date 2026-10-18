"""
把三张肖像图转成片头用的 ASCII 转头帧（scripts/faces.json）。只在本地跑一次，CI 不需要。

    python3 scripts/faces-from-images.py <ghost 图> <crimson 图> <phantom 图>

- 原图不进仓库，仓库里只存转换后的字符帧。
- 整张图都用上，只抹掉图上的标题、logo 和小字（PORTRAITS 里的 erase 区域）。
- 转头：把图贴在一个圆柱面上，左右转动 ±SWING 弧度，得到 FRAMES 帧（face.mjs 会往返播放）。
- 每个字符格混合两种信号：线条（边缘强度）和亮度，按 face.mjs 里同一串字符从疏到密映射。
  三张图的明暗差别很大（线稿 / 暗红渲染 / 写实照片），所以每张图有自己的取值和权重。
- 图的四边逐渐变稀，字符散进背景里，不需要再用遮罩。
- 每张图的“高光”像素（发光的眼睛、红光、橙色的油彩）标成强调色，face.mjs 会给它单独上色。
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAMP = " .'`,:;-~=+*o%#&@"
ROWS, FRAMES, SWING, RADIUS = 100, 12, 0.36, 1.35
CELL = 0.6 / 1.02  # 字符格的宽高比（face.mjs：字宽 0.6em，行高 1.02em）
SUB_Y, SUB_X = 8, 5  # 每个字符格里取样的点数
FEATHER = 0.1  # 四边变稀的宽度（占图宽 / 图高的比例）


def hsv(img):
    R, G, B = img[..., 0], img[..., 1], img[..., 2]
    v = img.max(-1)
    c = v - img.min(-1)
    s = np.where(v > 0, c / np.maximum(v, 1e-6), 0)
    h = np.zeros_like(v)
    safe = np.maximum(c, 1e-6)
    h = np.where(v == R, ((G - B) / safe) % 6, h)
    h = np.where(v == G, (B - R) / safe + 2, h)
    h = np.where(v == B, (R - G) / safe + 4, h)
    return np.where(c > 0, h * 60, 0), s, v


PORTRAITS = [
    {
        # 线稿：白线 + 紫发 + 红色光痕。顶部标题那一条整个裁掉，左边的 C1–C3 小字和标题下方的支架线抹掉
        'id': 'ghost',
        'crop': (0, 240, 736, 1314),
        'erase': [(438, 236, 452, 272), (72, 269, 95, 289), (72, 340, 95, 360), (72, 388, 95, 408)],
        'channel': 'value', 'lo': 1, 'hi': 99.6, 'gamma': 1.0, 'local': 0.7,
        'edge': 0.5, 'fill': 0.85, 'cut': 0.1, 'span': 0.7, 'curve': 1.25,
        'accent': lambda h, s, v, R, G, B: (R > 0.42) & (R > 1.7 * G) & (R > 1.5 * B),
        'accent_frac': 0.14, 'accent_min': 0.45,
    },
    {
        # 暗红的渲染图：用最亮的通道当亮度，提亮暗部；高光是最亮的那一档红
        'id': 'crimson',
        'crop': None,
        'erase': [],
        'channel': 'value', 'lo': 4, 'hi': 99.5, 'gamma': 0.75, 'local': 0.9,
        'edge': 0.3, 'fill': 0.85, 'cut': 0.1, 'span': 0.78, 'curve': 1.3,
        'accent': lambda h, s, v, R, G, B: (v > 0.6) & ((h < 30) | (h > 330)),
        'accent_frac': 0.25, 'accent_min': 0,
    },
    {
        # 写实照片：左上角的 logo 和右下角的版权小字抹掉（版权声明改写在片头的图注里）；高光是橙色油彩
        'id': 'phantom',
        'crop': None,
        'erase': [(14, 12, 120, 40), (330, 572, 595, 600)],
        'channel': 'value', 'lo': 2, 'hi': 99.6, 'gamma': 1.1, 'local': 1.0,
        'edge': 0.25, 'fill': 0.9, 'cut': 0.1, 'span': 0.75, 'curve': 1.3,
        'accent': lambda h, s, v, R, G, B: (s > 0.6) & (v > 0.55) & (h > 8) & (h < 32),
        'accent_frac': 0.35, 'accent_min': 0,
    },
]


def blur(a, passes=1):
    k = np.array([1, 4, 6, 4, 1], dtype=np.float32) / 16
    for _ in range(passes):
        a = np.apply_along_axis(lambda r: np.convolve(r, k, mode='same'), 1, a)
        a = np.apply_along_axis(lambda c: np.convolve(c, k, mode='same'), 0, a)
    return a


def erase(img, boxes):
    """抹掉小字：整个框挖空（连字周围的光晕一起），再用框外的像素一圈圈扩散补上"""
    if not boxes:
        return img
    hole = np.zeros(img.shape[:2], bool)
    for x0, y0, x1, y1 in boxes:
        hole[y0:y1, x0:x1] = True
    out = img.copy()
    out[hole] = 0
    for _ in range(600):
        avg = (np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 4
        out[hole] = avg[hole]
    return out


def resize(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BILINEAR))


def convert(path, cfg):
    img = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255
    img = erase(img, cfg['erase'])
    if cfg['crop']:
        x0, y0, x1, y1 = cfg['crop']
        img = img[y0:y1, x0:x1]
    H, W, _ = img.shape
    cols = round(ROWS * (W / H) / CELL)
    R, G, B = img[..., 0], img[..., 1], img[..., 2]
    h, s, v = hsv(img)
    base = 0.299 * R + 0.587 * G + 0.114 * B if cfg['channel'] == 'lum' else v
    lo, hi = np.percentile(base, cfg['lo']), np.percentile(base, cfg['hi'])
    base = np.clip((base - lo) / (hi - lo + 1e-6), 0, 1) ** cfg['gamma']
    # 局部对比增强（大半径的反锐化）：五官、轮廓这些结构在字符画里更容易认出来
    base = np.clip(base + cfg['local'] * (base - blur(base, 6)), 0, 1)
    accent = cfg['accent'](h, s, v, R, G, B).astype(np.float32)

    # 边缘强度：先轻微模糊，再用 Sobel 求梯度，按 99 分位归一化
    b = blur(base)
    gx = np.zeros_like(b)
    gy = np.zeros_like(b)
    gx[1:-1, 1:-1] = (b[:-2, 2:] + 2 * b[1:-1, 2:] + b[2:, 2:]) - (b[:-2, :-2] + 2 * b[1:-1, :-2] + b[2:, :-2])
    gy[1:-1, 1:-1] = (b[2:, :-2] + 2 * b[2:, 1:-1] + b[2:, 2:]) - (b[:-2, :-2] + 2 * b[:-2, 1:-1] + b[:-2, 2:])
    edge = np.hypot(gx, gy)
    edge = np.clip(edge / (np.percentile(edge, 99) + 1e-6), 0, 1)

    # 四边变稀：离边越近，字符越疏
    def ramp(t):
        t = np.clip(t / FEATHER, 0, 1)
        return t * t * (3 - 2 * t)

    u = (np.arange(cols) + 0.5) / cols
    w_ = (np.arange(ROWS) + 0.5) / ROWS
    feather = ramp(np.minimum(w_, 1 - w_))[:, None] * ramp(np.minimum(u, 1 - u))[None, :]

    ws = cols * SUB_X
    xs_out = np.linspace(-1, 1, ws)
    frames = []
    for f in range(FRAMES):
        yaw = -SWING + 2 * SWING * f / (FRAMES - 1)
        # 圆柱投影：屏幕上的 x' = R·sin(θ')，转动 yaw 后在原图上的位置 x = R·sin(θ' − yaw)
        th = np.arcsin(np.clip(xs_out / RADIUS, -1, 1)) - yaw
        xs = RADIUS * np.sin(th)
        valid = (np.abs(th) < math.pi / 2) & (np.abs(xs) <= 1)
        col = np.clip((xs + 1) / 2 * (W - 1), 0, W - 1)
        c0 = np.floor(col).astype(int)
        c1 = np.minimum(c0 + 1, W - 1)
        k = (col - c0)[None, :]
        shade = (0.78 + 0.22 * np.cos(th))[None, :] * valid[None, :]

        def warp(a, sh):
            out = (a[:, c0] * (1 - k) + a[:, c1] * k) * sh
            return resize(out, ws, ROWS * SUB_Y).reshape(ROWS, SUB_Y, cols, SUB_X).transpose(0, 2, 1, 3).reshape(ROWS, cols, -1)

        L = warp(base, shade).mean(-1)
        D = np.percentile(warp(edge, shade), 80, axis=-1)
        E = warp(accent, valid[None, :].astype(np.float32)).mean(-1)

        val = cfg['edge'] * D + cfg['fill'] * L
        val = np.clip((val - cfg['cut']) / cfg['span'], 0, 1) ** cfg['curve']
        is_acc = (E > cfg['accent_frac']) & (feather > 0.35)
        val = np.where(is_acc, np.maximum(val, cfg['accent_min']), val) * feather
        idx = np.minimum(len(RAMP) - 1, np.round(val * (len(RAMP) - 1)).astype(int))

        lines, acc = [], []
        for r in range(ROWS):
            line = ''.join(RAMP[i] for i in idx[r])
            lines.append(line)
            c = 0
            while c < cols:
                if is_acc[r, c] and line[c] != ' ':
                    start = c
                    while c < cols and is_acc[r, c] and line[c] != ' ':
                        c += 1
                    acc.append([r, start, c])
                else:
                    c += 1
        frames.append({'lines': lines, 'acc': acc})
    return {'id': cfg['id'], 'cols': cols, 'rows': ROWS, 'frames': frames}


if len(sys.argv) != 1 + len(PORTRAITS):
    sys.exit(__doc__)
out = [convert(path, cfg) for path, cfg in zip(sys.argv[1:], PORTRAITS)]
dst = Path(__file__).with_name('faces.json')
dst.write_text(json.dumps({'portraits': out}, ensure_ascii=False, separators=(',', ':')))
print(f'wrote {dst} ({dst.stat().st_size / 1024:.1f} KB)')
for p in out:
    print(f"  {p['id']}: {p['cols']}×{p['rows']}, {len(p['frames'])} frames")
