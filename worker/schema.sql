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
