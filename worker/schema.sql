-- 信号台的数据。只存动作、时间、国家/地区代码，以及按天轮换、加盐的访客哈希（只用于限流）。
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  action TEXT NOT NULL,
  country TEXT NOT NULL,
  who TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS signals_who_ts ON signals (who, ts);

CREATE TABLE IF NOT EXISTS counters (
  action TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);

-- 看板娘互动（kind = 'pet'）和抽卡（kind = 'gacha'，extra 是稀有度）
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  item TEXT NOT NULL,
  extra TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL,
  who TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS actions_kind_ts ON actions (kind, ts);
CREATE INDEX IF NOT EXISTS actions_who_kind_ts ON actions (who, kind, ts);
