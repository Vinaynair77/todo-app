import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'app.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    google_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    type TEXT NOT NULL DEFAULT 'personal',
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_members (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (task_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_task_members_user ON task_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`)

// Migration: older databases stored the account identifier in a "username" column.
// The identifier can be either a username or an email address.
const userColumns = db.prepare('PRAGMA table_info(users)').all()
const hasUsername = userColumns.some((column) => column.name === 'username')
const hasIdentifier = userColumns.some((column) => column.name === 'identifier')
if (hasUsername && !hasIdentifier) {
  db.exec('ALTER TABLE users RENAME COLUMN username TO identifier')
}

// Migration: Google sign-in support — older databases lack the google_id column.
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'google_id')) {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT')
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)')

// Migration: shared team tasks. Existing tasks become personal.
const taskColumns = db.prepare('PRAGMA table_info(tasks)').all()
if (!taskColumns.some((column) => column.name === 'type')) {
  db.exec("ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'personal'")
}
if (!taskColumns.some((column) => column.name === 'completed_by')) {
  db.exec('ALTER TABLE tasks ADD COLUMN completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL')
}

// Migration: named teams — a task may be shared with a team instead of individuals.
if (!db.prepare('PRAGMA table_info(tasks)').all().some((column) => column.name === 'team_id')) {
  db.exec('ALTER TABLE tasks ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL')
}
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id)')
