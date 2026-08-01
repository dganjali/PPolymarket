import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCHEMA = `
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
  dispute_window_hours INTEGER NOT NULL DEFAULT 24,
  current_season    INTEGER NOT NULL DEFAULT 1,
  season_started_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  proposed_outcome TEXT,
  resolution_evidence TEXT NOT NULL DEFAULT '',
  resolution_proposed_by INTEGER REFERENCES users(id),
  resolution_proposed_at TEXT,
  dispute_ends_at TEXT,
  season_number INTEGER NOT NULL DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS market_disputes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (market_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_disputes_market ON market_disputes(market_id, id DESC);

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

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id    INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  market_id   INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, id DESC);

CREATE TABLE IF NOT EXISTS season_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank          INTEGER NOT NULL,
  final_total   REAL NOT NULL,
  pnl           REAL NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, season_number, user_id)
);
CREATE INDEX IF NOT EXISTS idx_season_results_group ON season_results(group_id, season_number, rank);
`;

declare global {
  // eslint-disable-next-line no-var
  var __minimarketDb: DatabaseSync | undefined;
}

/** Columns added after the first release, applied to already-created tables. */
const ADDITIONS: [table: string, column: string, ddl: string][] = [
  ['users', 'email', 'TEXT'],
  ['users', 'google_sub', 'TEXT'],
  ['groups', 'market_liquidity', 'REAL NOT NULL DEFAULT 500'],
  ['groups', 'dispute_window_hours', 'INTEGER NOT NULL DEFAULT 24'],
  ['groups', 'current_season', 'INTEGER NOT NULL DEFAULT 1'],
  ['groups', 'season_started_at', "TEXT NOT NULL DEFAULT ''"],
  ['markets', 'house', 'REAL NOT NULL DEFAULT 0'],
  ['markets', 'proposed_outcome', 'TEXT'],
  ['markets', 'resolution_evidence', "TEXT NOT NULL DEFAULT ''"],
  ['markets', 'resolution_proposed_by', 'INTEGER'],
  ['markets', 'resolution_proposed_at', 'TEXT'],
  ['markets', 'dispute_ends_at', 'TEXT'],
  ['markets', 'season_number', 'INTEGER NOT NULL DEFAULT 1'],
];

function migrate(db: DatabaseSync) {
  for (const [table, column, ddl] of ADDITIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      } catch (error) {
        // Another Next build worker may have added it after our table_info read.
        if (!(error instanceof Error) || !/duplicate column/i.test(error.message)) throw error;
      }
    }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_sub) WHERE google_sub IS NOT NULL');
  db.exec("UPDATE groups SET season_started_at = created_at WHERE season_started_at = ''");
}

function open(): DatabaseSync {
  const file = resolve(process.env.DATABASE_PATH ?? 'data/minimarket.db');
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // Next may evaluate several routes in parallel during a production build.
  // Let schema initialization wait for another worker instead of failing fast.
  db.exec('PRAGMA busy_timeout = 10000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
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
