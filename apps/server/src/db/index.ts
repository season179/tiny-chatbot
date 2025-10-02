import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqliteDb: Database.Database | null = null;

export interface DatabaseOptions {
  path: string;
  runMigrations?: boolean;
}

function createTablesManually(sqliteDb: Database.Database): void {
  // Create sessions table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      traits TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Create messages table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_name TEXT,
      tool_call_id TEXT,
      arguments TEXT,
      result TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  // Create index on session_id
  sqliteDb.exec(`
    CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
  `);
}

export function initDatabase(options: DatabaseOptions): BetterSQLite3Database<typeof schema> {
  if (db) {
    return db;
  }

  // Create parent directory if it doesn't exist (except for :memory:)
  if (options.path !== ':memory:') {
    const dir = dirname(options.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  sqliteDb = new Database(options.path);
  db = drizzle(sqliteDb, { schema });

  // Run migrations if requested
  if (options.runMigrations && options.path !== ':memory:') {
    migrate(db, { migrationsFolder: './drizzle' });
  } else {
    // For :memory: databases or when migrations are not run, create tables manually
    createTablesManually(sqliteDb);
  }

  return db;
}

export function getDatabase(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return db;
}

// For testing purposes only - provides access to raw SQLite database
export function getRawDatabase(): Database.Database {
  if (!sqliteDb) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return sqliteDb;
}

export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
  }
}

// For testing purposes only
export function resetDatabase(): void {
  closeDatabase();
}
