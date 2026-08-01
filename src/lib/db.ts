import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import postgres, { type Sql } from 'postgres';

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
  require_member_approval INTEGER NOT NULL DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS membership_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_membership_requests_group ON membership_requests(group_id, id);

CREATE TABLE IF NOT EXISTS membership_grants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  granted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, group_id, season_number)
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
  market_type  TEXT NOT NULL DEFAULT 'binary',
  outcome      TEXT,
  yes_reserve  REAL NOT NULL,
  no_reserve   REAL NOT NULL,
  collateral   REAL NOT NULL,
  fees         REAL NOT NULL DEFAULT 0,
  subsidy      REAL NOT NULL DEFAULT 0,
  house        REAL NOT NULL DEFAULT 0,
  volume       REAL NOT NULL DEFAULT 0,
  open_price   REAL NOT NULL DEFAULT 0.5,
  lmsr_b       REAL NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS market_restrictions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT 'Connected to the outcome',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (market_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_market_restrictions_market ON market_restrictions(market_id, user_id);

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

CREATE TABLE IF NOT EXISTS market_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  quantity    REAL NOT NULL DEFAULT 0,
  UNIQUE (market_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_market_options_market ON market_options(market_id, sort_order);

CREATE TABLE IF NOT EXISTS option_positions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id   INTEGER NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shares      REAL NOT NULL DEFAULT 0,
  cost        REAL NOT NULL DEFAULT 0,
  realized    REAL NOT NULL DEFAULT 0,
  UNIQUE (option_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_option_positions_user ON option_positions(user_id, market_id);

CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side          TEXT NOT NULL,
  option_id     INTEGER REFERENCES market_options(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS option_price_points (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  option_id   INTEGER NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  price       REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_option_price_points ON option_price_points(option_id, id);

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
  // eslint-disable-next-line no-var
  var __minimarketPg: Sql | undefined;
  // eslint-disable-next-line no-var
  var __minimarketPgReady: Promise<void> | undefined;
}

/** Columns added after the first release, applied to already-created tables. */
const ADDITIONS: [table: string, column: string, ddl: string][] = [
  ['users', 'email', 'TEXT'],
  ['users', 'google_sub', 'TEXT'],
  ['groups', 'market_liquidity', 'REAL NOT NULL DEFAULT 500'],
  ['groups', 'require_member_approval', 'INTEGER NOT NULL DEFAULT 1'],
  ['groups', 'dispute_window_hours', 'INTEGER NOT NULL DEFAULT 24'],
  ['groups', 'current_season', 'INTEGER NOT NULL DEFAULT 1'],
  ['groups', 'season_started_at', "TEXT NOT NULL DEFAULT ''"],
  ['markets', 'house', 'REAL NOT NULL DEFAULT 0'],
  ['markets', 'market_type', "TEXT NOT NULL DEFAULT 'binary'"],
  ['markets', 'lmsr_b', 'REAL NOT NULL DEFAULT 0'],
  ['markets', 'proposed_outcome', 'TEXT'],
  ['markets', 'resolution_evidence', "TEXT NOT NULL DEFAULT ''"],
  ['markets', 'resolution_proposed_by', 'INTEGER'],
  ['markets', 'resolution_proposed_at', 'TEXT'],
  ['markets', 'dispute_ends_at', 'TEXT'],
  ['markets', 'season_number', 'INTEGER NOT NULL DEFAULT 1'],
  ['trades', 'option_id', 'INTEGER'],
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
  db.exec(`INSERT OR IGNORE INTO membership_grants (user_id, group_id, season_number, granted_at)
           SELECT ms.user_id, ms.group_id, g.current_season, ms.joined_at
             FROM memberships ms JOIN groups g ON g.id = ms.group_id`);
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

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const usingPostgres = !!postgresUrl;

// Cached on globalThis so Next's dev-server module reloads reuse one handle.
// Scripts and local development continue to use SQLite; Vercel uses Supabase Postgres.
export const db: DatabaseSync = (
  usingPostgres ? undefined : globalThis.__minimarketDb ?? (globalThis.__minimarketDb = open())
) as DatabaseSync;

const pg = usingPostgres
  ? globalThis.__minimarketPg ??
    (globalThis.__minimarketPg = postgres(postgresUrl!, {
      prepare: false,
      max: 6,
      idle_timeout: 20,
      connect_timeout: 15,
    }))
  : undefined;

type Queryable = Sql;
const pgTransaction = new AsyncLocalStorage<Queryable>();

const pgNow = "to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS')";

function postgresSchema(): string {
  return SCHEMA
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
    .replace(/datetime\('now'\)/g, pgNow);
}

async function ensurePostgres(): Promise<void> {
  if (!pg) return;
  if (!globalThis.__minimarketPgReady) {
    globalThis.__minimarketPgReady = (async () => {
      await pg.unsafe(postgresSchema());
      for (const [table, column, ddl] of ADDITIONS) {
        const postgresDdl = ddl
          .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
          .replace(/datetime\('now'\)/g, pgNow);
        await pg.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${postgresDdl}`);
      }
      await pg.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
      await pg.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_sub) WHERE google_sub IS NOT NULL');
      await pg.unsafe("UPDATE groups SET season_started_at = created_at WHERE season_started_at = ''");
      await pg.unsafe(
        `INSERT INTO membership_grants (user_id, group_id, season_number, granted_at)
         SELECT ms.user_id, ms.group_id, g.current_season, ms.joined_at
           FROM memberships ms JOIN groups g ON g.id = ms.group_id
         ON CONFLICT DO NOTHING`,
      );
    })();
  }
  await globalThis.__minimarketPgReady;
}

type Row = Record<string, unknown>;

/**
 * node:sqlite hands back rows with a null prototype. React refuses to
 * serialize those across the server/client boundary, so every row is copied
 * into a plain object on the way out.
 */
const plain = <T>(row: T): T => (row == null ? row : ({ ...row } as T));

function postgresSql(input: string, mode: 'read' | 'run'): string {
  let sql = input.trim().replace(/datetime\('now'\)/g, pgNow);
  const ignored = /^INSERT OR IGNORE\s+INTO/i.test(sql);
  if (ignored) sql = sql.replace(/^INSERT OR IGNORE\s+INTO/i, 'INSERT INTO');
  let index = 0;
  sql = sql.replace(/\?/g, () => `$${++index}`);
  if (ignored) sql = `${sql.replace(/;$/, '')} ON CONFLICT DO NOTHING`;
  if (mode === 'run' && /^INSERT\s+INTO/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
    sql = `${sql.replace(/;$/, '')} RETURNING id`;
  }
  return sql;
}

async function pgQuery<T = Row>(sql: string, params: unknown[], mode: 'read' | 'run') {
  await ensurePostgres();
  const client = pgTransaction.getStore() ?? pg!;
  return await client.unsafe(postgresSql(sql, mode), params as never[]) as unknown as T[] & { count: number };
}

export async function all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
  if (pg) return Array.from(await pgQuery<T>(sql, params, 'read'), plain);
  return (db.prepare(sql).all(...(params as never[])) as T[]).map(plain);
}

export async function get<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  if (pg) {
    const rows = await pgQuery<T>(sql, params, 'read');
    return rows.length ? plain(rows[0]) : undefined;
  }
  const row = db.prepare(sql).get(...(params as never[])) as T | undefined;
  return row === undefined ? undefined : plain(row);
}

export async function run(sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number; changes: number }> {
  if (pg) {
    const rows = await pgQuery<{ id?: number }>(sql, params, 'run');
    return { lastInsertRowid: Number(rows[0]?.id ?? 0), changes: rows.count };
  }
  const result = db.prepare(sql).run(...(params as never[]));
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

/** Runs `fn` inside a transaction, rolling back on throw. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (pg) {
    await ensurePostgres();
    return await pg.begin((transaction) => pgTransaction.run(transaction as unknown as Queryable, fn)) as unknown as T;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = await fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
