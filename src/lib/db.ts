import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  handle      TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  invite_code       TEXT NOT NULL UNIQUE,
  owner_id          INTEGER NOT NULL REFERENCES users(id),
  starting_balance  REAL NOT NULL DEFAULT 2500,
  market_liquidity  REAL NOT NULL DEFAULT 500,
  season_ends       TEXT,
  prize             TEXT NOT NULL DEFAULT '',
  punishment        TEXT NOT NULL DEFAULT '',
  positions_public  INTEGER NOT NULL DEFAULT 1,
  require_approval  INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  balance    REAL NOT NULL DEFAULT 0,
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS markets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id   INTEGER NOT NULL REFERENCES users(id),
  question     TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'Other',
  rules        TEXT NOT NULL DEFAULT '',
  closes_at    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  outcome      TEXT,
  yes_reserve  REAL NOT NULL,
  no_reserve   REAL NOT NULL,
  collateral   REAL NOT NULL,
  fees         REAL NOT NULL DEFAULT 0,
  subsidy      REAL NOT NULL DEFAULT 0,
  house        REAL NOT NULL DEFAULT 0,
  volume       REAL NOT NULL DEFAULT 0,
  open_price   REAL NOT NULL DEFAULT 0.5,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_markets_group ON markets(group_id, status);

CREATE TABLE IF NOT EXISTS positions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yes_shares  REAL NOT NULL DEFAULT 0,
  no_shares   REAL NOT NULL DEFAULT 0,
  yes_cost    REAL NOT NULL DEFAULT 0,
  no_cost     REAL NOT NULL DEFAULT 0,
  realized    REAL NOT NULL DEFAULT 0,
  UNIQUE (market_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id, market_id);

CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side          TEXT NOT NULL,
  action        TEXT NOT NULL,
  shares        REAL NOT NULL,
  cash          REAL NOT NULL,
  avg_price     REAL NOT NULL,
  price_after   REAL NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id, id DESC);

CREATE TABLE IF NOT EXISTS price_points (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  price       REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_market ON price_points(market_id, id);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_market ON comments(market_id, id DESC);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  market_id   INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id, id DESC);
`;

declare global {
  // eslint-disable-next-line no-var
  var __minimarketDb: DatabaseSync | undefined;
}

/** Columns added after the first release, applied to already-created tables. */
const ADDITIONS: [table: string, column: string, ddl: string][] = [
  ['groups', 'market_liquidity', 'REAL NOT NULL DEFAULT 500'],
  ['markets', 'house', 'REAL NOT NULL DEFAULT 0'],
];

function migrate(db: DatabaseSync) {
  for (const [table, column, ddl] of ADDITIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

function open(): DatabaseSync {
  const file = resolve(process.env.DATABASE_PATH ?? 'data/minimarket.db');
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Cached on globalThis so Next's dev-server module reloads reuse one handle.
export const db: DatabaseSync = globalThis.__minimarketDb ?? (globalThis.__minimarketDb = open());

type Row = Record<string, unknown>;

/**
 * node:sqlite hands back rows with a null prototype. React refuses to
 * serialize those across the server/client boundary, so every row is copied
 * into a plain object on the way out.
 */
const plain = <T>(row: T): T => (row == null ? row : ({ ...row } as T));

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return (db.prepare(sql).all(...(params as never[])) as T[]).map(plain);
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const row = db.prepare(sql).get(...(params as never[])) as T | undefined;
  return row === undefined ? undefined : plain(row);
}

export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}

/** Runs `fn` inside a transaction, rolling back on throw. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
