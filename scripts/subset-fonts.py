"""
从系统的 Noto CJK 字体里抽出 scripts/story.mjs 用到的字，存成 woff2 子集（嵌进 SVG 用）。
文字改了以后在仓库根目录运行：python3 scripts/subset-fonts.py（需要 fonttools + brotli 和 Noto CJK 字体）
"""
import json, subprocess, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTCollection

ROOT = Path(__file__).resolve().parent.parent
chars = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/story.mjs'), '--chars']))
SOURCES = {
    # name: (ttc, index)  index 0 = JP，2 = SC
    'logo': ('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', 0),
    'serif': ('/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc', 0),
    'ui': ('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 2),
}
for name, (ttc, index) in SOURCES.items():
    font = TTCollection(ttc).fonts[index]
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['kern', 'palt']
    options.name_IDs = ['*']
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(text=chars[name])
    sub.subset(font)
    out = ROOT / 'scripts/fonts' / f'cjk-{name}.woff2'
    font.flavor = 'woff2'
    font.save(out)
    print(f'{out.name}: {len(chars[name])} chars, {out.stat().st_size / 1024:.1f} KB')
