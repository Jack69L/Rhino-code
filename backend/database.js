const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'earncoin.db.json');

let db;
let SQL;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH + '.bin', Buffer.from(data));
}

async function initDb() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH + '.bin')) {
    const buf = fs.readFileSync(DB_PATH + '.bin');
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT UNIQUE NOT NULL,
      username TEXT, first_name TEXT, last_name TEXT,
      balance REAL DEFAULT 0, total_earned REAL DEFAULT 0,
      referral_code TEXT UNIQUE NOT NULL, referred_by TEXT,
      login_streak INTEGER DEFAULT 0, longest_streak INTEGER DEFAULT 0,
      last_login_date TEXT, level INTEGER DEFAULT 1,
      ads_watched_today INTEGER DEFAULT 0, ads_watched_total INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0, total_referrals INTEGER DEFAULT 0,
      last_spin_date TEXT, scratch_cards_available INTEGER DEFAULT 0,
      ads_this_month INTEGER DEFAULT 0, current_month TEXT,
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL,
      type TEXT NOT NULL, amount REAL NOT NULL, description TEXT,
      status TEXT DEFAULT 'completed', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL,
      amount REAL NOT NULL, method TEXT NOT NULL, address TEXT NOT NULL,
      status TEXT DEFAULT 'pending', admin_note TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      description TEXT, reward REAL NOT NULL, type TEXT NOT NULL,
      link TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL,
      task_id INTEGER NOT NULL, completed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(telegram_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS withdrawal_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL UNIQUE,
      has_invited_5 INTEGER DEFAULT 0, has_30day_streak INTEGER DEFAULT 0,
      has_watched_100_ads INTEGER DEFAULT 0, has_completed_5_tasks INTEGER DEFAULT 0,
      has_verified_account INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed tasks
  const taskCount = getOne('SELECT COUNT(*) as count FROM tasks');
  if (!taskCount || taskCount.count === 0) {
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Join Telegram Channel','Join @EarnCoinNews for updates',0.50,'telegram','https://t.me/EarnCoinNews')");
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Follow on Twitter/X','Follow @EarnCoinApp on X',0.50,'social','https://twitter.com/EarnCoinApp')");
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Rate our bot','Leave a 5-star review on the store',0.25,'review',NULL)");
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Complete your profile','Add your payment method',0.75,'profile',NULL)");
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Watch 5 ads in a row','Watch 5 consecutive ads without closing',1.00,'ads',NULL)");
    run("INSERT INTO tasks (title, description, reward, type, link) VALUES ('Refer your first friend','Invite one friend who joins EarnCoin',1.00,'referral',NULL)");
    saveDb();
  }

  return db;
}

// Helper wrappers with auto-save
function run(sql, params=[]) {
  db.run(sql, params);
  saveDb();
}

function getOne(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = {};
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    cols.forEach((c,i) => row[c] = vals[i]);
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const row = {};
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    cols.forEach((c,i) => row[c] = vals[i]);
    rows.push(row);
  }
  stmt.free();
  return rows;
}

module.exports = { initDb, run, getOne, getAll, saveDb };
