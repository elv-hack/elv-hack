/**
 * 虚构的 90 年代动画「エルヴハック」里所有固定的文字：卡牌、看板娘台词、按钮、片尾字幕。
 * 字体子集（scripts/subset-fonts.py）按这里出现的字来抽，改了文字要重新跑一遍。
 */

/** 抽卡卡池。rarity 决定边框；概率见 RATES */
export const CARDS = [
  { id: 'crossing', rarity: 'R', ja: '放課後の踏切', zh: '放学后的道口' },
  { id: 'vending', rarity: 'R', ja: '自販機の灯り', zh: '自动贩卖机的光' },
  { id: 'cassette', rarity: 'R', ja: '夏のカセット', zh: '夏天的磁带' },
  { id: 'midnight', rarity: 'SR', ja: '深夜二時のコード', zh: '凌晨两点的代码' },
  { id: 'sunset', rarity: 'SR', ja: '夕焼けの約束', zh: '晚霞之约' },
  { id: 'boot', rarity: 'SSR', ja: 'エルヴ、起動。', zh: '看板娘，启动。' },
];

export const RATES = { SSR: 0.03, SR: 0.17, R: 0.8 };

/** 看板娘按日本时间说的话；周末白天另有一句 */
export const TIME_LINES = [
  { from: 0, to: 5, expr: 'sleepy', text: '都几点了还不睡！……算了，那我陪你一会儿' },
  { from: 5, to: 9, expr: 'happy', text: 'おはよう！早起写代码的人最帅了 ☆' },
  { from: 9, to: 12, expr: 'neutral', text: '上午是 debug 的黄金时间，加油哦～' },
  { from: 12, to: 14, expr: 'pout', text: '午饭吃了吗？……我想喝奶茶。' },
  { from: 14, to: 18, expr: 'sleepy', text: '下午的阳光好暖……有、有点困了' },
  { from: 18, to: 21, expr: 'happy', text: '夕焼け好漂亮。今天的信号也很清楚哦' },
  { from: 21, to: 24, expr: 'neutral', text: '晚上好～在补番，还是在写代码？' },
];
export const WEEKEND_LINE = { expr: 'happy', text: '周末！今天一起补番吧 ☆' };

/** 访客互动后 10 分钟内的反应 */
export const REACTIONS = {
  milktea: { expr: 'happy', text: 'ミルクティー！谢谢你～最喜欢了 ♪' },
  headpat: { expr: 'blush', text: 'えへへ……再、再摸一下也可以哦' },
  poke: { expr: 'surprised', text: 'ひゃっ！？别、别戳啦！' },
  pokeAgain: { expr: 'pout', text: 'もう！再戳我就不理你了……' },
  ssr: { expr: 'happy', text: 'すごい！刚刚有人抽到 SSR 了！' },
  firstVisit: { expr: 'neutral', text: '欢迎来到エルヴハック。请多关照！' },
};

/** 按钮：action → 日文大字 + 中文小字 */
export const BUTTONS = {
  milktea: { ja: 'ミルクティー', zh: '投喂奶茶', note: '好感度 +3' },
  headpat: { ja: 'なでなで', zh: '摸摸头', note: '好感度 +2' },
  poke: { ja: 'つんつん', zh: '戳一下', note: '好感度 +1' },
  pull: { ja: '単発ガチャ', zh: '单抽一次', note: 'SSR 3%' },
  ping: { ja: 'ピン', zh: 'PING', note: '发个信号' },
  scan: { ja: 'スキャン', zh: 'SCAN', note: '扫描一下' },
  decrypt: { ja: 'デコード', zh: 'DECRYPT', note: '试着解码' },
  trace: { ja: 'トレース', zh: 'TRACE', note: '留下足迹' },
};

export const EPISODE = {
  dark: { no: '第1話', title: '信号は、夕焼けの向こう' },
  light: { no: '第1話', title: '信号は、入道雲の向こう' },
};

/** 片尾字幕：职务 → 名字（名字是仓库，README 里另有链接） */
export const STAFF = [
  ['原作・脚本', 'elvhack'],
  ['量化監修', 'quantcore'],
  ['セキュリティ', 'Z3r0'],
  ['開発', 'elvhack'],
  ['情報解析', 'nexus'],
  ['看板娘', 'エルヴ'],
  ['主題歌', '「信号は夕焼けの向こう」'],
  ['制作', 'ELVHACK.COM'],
];

/** 各 SVG 里出现的固定标签，按字体分组（子集化时也要用） */
export const LABELS = {
  logo: ['エルヴハック', 'エルヴ', '好感度', '最新', '図鑑', '通信ログ', '放送記録', '次回予告', 'ガチャ', '提供', 'おわり'],
  ui: [
    '好感度', '奶茶', '摸头', '戳', '最新一抽', '累计', '抽', '还没有人抽卡', '点下面的按钮', '来抽第一张吧',
    '出货率', '刚刚', '秒前', '分钟前', '小时前', '天前', '图鉴', '收集', '张', '次', '日本时间', '周末',
    '还没有信号', '按下面的按钮发出第一条', '来自', '条', '合计', '最后联络', '新闻', '行情', '离线',
    '过去一年', '次提交', '峰值', '月', '天', '星期', '一', '二', '三', '四', '五', '六', '日',
    '？？？', '未解锁', '抽到', '全站', '的', '了', '张卡', '来自地区',
  ],
  serif: ['第', '話', '終', 'スタッフ', '主題歌', 'エンディング'],
};

/** 每种字体需要的全部字符（含 ASCII） */
export function fontText() {
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  const lines = [...TIME_LINES.map((l) => l.text), WEEKEND_LINE.text, ...Object.values(REACTIONS).map((r) => r.text)];
  const buttons = Object.values(BUTTONS);
  return {
    // 按钮上的中文也放进 logo 字体，按钮就只需要嵌这一种中日文字体
    logo: ascii + LABELS.logo.join('') + buttons.map((b) => b.ja + b.zh + b.note).join('') + CARDS.map((c) => c.ja).join(''),
    serif:
      ascii +
      LABELS.serif.join('') +
      CARDS.map((c) => c.ja).join('') +
      Object.values(EPISODE).map((e) => e.no + e.title).join('') +
      STAFF.flat().join(''),
    ui: ascii + LABELS.ui.join('') + lines.join('') + buttons.map((b) => b.zh + b.note).join('') + CARDS.map((c) => c.zh).join('') + '０１２３４５６７８９',
  };
}

// Worker 里没有 process，只在 node scripts/story.mjs --chars 时打印
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('story.mjs') && process.argv[2] === '--chars') {
  const t = fontText();
  const uniq = (s) => [...new Set(s)].join('');
  console.log(JSON.stringify({ logo: uniq(t.logo), serif: uniq(t.serif), ui: uniq(t.ui) }));
}
