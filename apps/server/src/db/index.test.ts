import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, getDatabase, closeDatabase, resetDatabase, getRawDatabase } from './index.js';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Database Module', () => {
  // Clean up any test databases after each test
  afterEach(() => {
    resetDatabase();
  });

  describe('initDatabase', () => {
    it('should initialize an in-memory database', () => {
      const db = initDatabase({ path: ':memory:', runMigrations: false });
      
      expect(db).toBeDefined();
      expect(typeof db).toBe('object');
    });

    it('should create database file and parent directory if they do not exist', () => {
      const testDir = join(tmpdir(), `test-db-${Date.now()}`);
      const dbPath = join(testDir, 'nested', 'test.db');
      
      try {
        expect(existsSync(testDir)).toBe(false);
        
        const db = initDatabase({ path: dbPath, runMigrations: false });
        
        expect(db).toBeDefined();
        expect(existsSync(testDir)).toBe(true);
        expect(existsSync(dbPath)).toBe(true);
      } finally {
        resetDatabase();
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    });

    it('should create database file in existing directory', () => {
      const testDir = join(tmpdir(), `test-db-existing-${Date.now()}`);
      const dbPath = join(testDir, 'test.db');
      
      try {
        mkdirSync(testDir, { recursive: true });
        expect(existsSync(testDir)).toBe(true);
        
        const db = initDatabase({ path: dbPath, runMigrations: false });
        
        expect(db).toBeDefined();
        expect(existsSync(dbPath)).toBe(true);
      } finally {
        resetDatabase();
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    });

    it('should be idempotent - returns same instance when called twice', () => {
      const db1 = initDatabase({ path: ':memory:', runMigrations: false });
      const db2 = initDatabase({ path: ':memory:', runMigrations: false });
      
      expect(db1).toBe(db2);
    });

    it('should create sessions table when migrations are not run', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // Try to insert into sessions table - should not throw
      expect(() => {
        rawDb.exec(`INSERT INTO sessions (id, tenant_id, created_at) VALUES ('test-id', 'test-tenant', '2024-01-01T00:00:00Z')`);
      }).not.toThrow();
    });

    it('should create messages table when migrations are not run', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // First insert a session (foreign key requirement)
      rawDb.exec(`INSERT INTO sessions (id, tenant_id, created_at) VALUES ('session-1', 'test-tenant', '2024-01-01T00:00:00Z')`);
      
      // Then try to insert into messages table - should not throw
      expect(() => {
        rawDb.exec(`INSERT INTO messages (id, session_id, role, content, created_at) VALUES ('msg-1', 'session-1', 'user', 'test', '2024-01-01T00:00:00Z')`);
      }).not.toThrow();
    });

    it('should create messages_session_id_idx index', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // Query sqlite_master to check if index exists
      const result = rawDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name='messages_session_id_idx'
      `).get() as { name: string } | undefined;
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('messages_session_id_idx');
    });

    it('should enforce foreign key constraint on messages.session_id', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // Try to insert message without corresponding session - should fail
      expect(() => {
        rawDb.exec(`INSERT INTO messages (id, session_id, role, content, created_at) VALUES ('msg-1', 'non-existent-session', 'user', 'test', '2024-01-01T00:00:00Z')`);
      }).toThrow();
    });

    it('should enforce cascade delete from sessions to messages', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // Insert session and message
      rawDb.exec(`INSERT INTO sessions (id, tenant_id, created_at) VALUES ('session-1', 'test-tenant', '2024-01-01T00:00:00Z')`);
      rawDb.exec(`INSERT INTO messages (id, session_id, role, content, created_at) VALUES ('msg-1', 'session-1', 'user', 'test', '2024-01-01T00:00:00Z')`);
      
      // Verify message exists
      const beforeDelete = rawDb.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?').get('session-1') as { count: number };
      expect(beforeDelete.count).toBe(1);
      
      // Delete session
      rawDb.prepare('DELETE FROM sessions WHERE id = ?').run('session-1');
      
      // Verify message was cascade deleted
      const afterDelete = rawDb.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?').get('session-1') as { count: number };
      expect(afterDelete.count).toBe(0);
    });

    it('should handle deeply nested directory paths', () => {
      const testDir = join(tmpdir(), `test-db-deep-${Date.now()}`);
      const dbPath = join(testDir, 'level1', 'level2', 'level3', 'test.db');
      
      try {
        const db = initDatabase({ path: dbPath, runMigrations: false });
        
        expect(db).toBeDefined();
        expect(existsSync(dbPath)).toBe(true);
      } finally {
        resetDatabase();
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    });

    it('should not create directory for :memory: database', () => {
      const beforeMemoryDirs = existsSync(':memory:');
      
      initDatabase({ path: ':memory:', runMigrations: false });
      
      // Verify no directory named ':memory:' was created
      const afterMemoryDirs = existsSync(':memory:');
      expect(beforeMemoryDirs).toBe(afterMemoryDirs);
    });
  });

  describe('getDatabase', () => {
    it('should return initialized database instance', () => {
      const initialized = initDatabase({ path: ':memory:', runMigrations: false });
      const retrieved = getDatabase();
      
      expect(retrieved).toBe(initialized);
      expect(retrieved).toBeDefined();
    });

    it('should throw error when database is not initialized', () => {
      expect(() => {
        getDatabase();
      }).toThrow('Database has not been initialized. Call initDatabase() first.');
    });

    it('should throw error after database is closed', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      closeDatabase();
      
      expect(() => {
        getDatabase();
      }).toThrow('Database has not been initialized. Call initDatabase() first.');
    });
  });

  describe('closeDatabase', () => {
    it('should close database connection', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      
      expect(() => {
        closeDatabase();
      }).not.toThrow();
      
      // Verify database is no longer accessible
      expect(() => {
        getDatabase();
      }).toThrow();
    });

    it('should be safe to call when database is not initialized', () => {
      expect(() => {
        closeDatabase();
      }).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      
      expect(() => {
        closeDatabase();
        closeDatabase();
        closeDatabase();
      }).not.toThrow();
    });

    it('should allow re-initialization after close', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      closeDatabase();
      
      const db = initDatabase({ path: ':memory:', runMigrations: false });
      expect(db).toBeDefined();
      expect(() => getDatabase()).not.toThrow();
    });
  });

  describe('resetDatabase', () => {
    it('should reset database state and allow re-initialization', () => {
      const db1 = initDatabase({ path: ':memory:', runMigrations: false });
      resetDatabase();
      
      const db2 = initDatabase({ path: ':memory:', runMigrations: false });
      
      // After reset, should get a new instance
      expect(db2).toBeDefined();
      expect(db1).not.toBe(db2);
    });

    it('should be safe to call when database is not initialized', () => {
      expect(() => {
        resetDatabase();
      }).not.toThrow();
    });
  });

  describe('schema integrity', () => {
    it('should create all required columns in sessions table', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      const result = rawDb.prepare(`PRAGMA table_info(sessions)`).all() as Array<{ name: string }>;
      const columnNames = result.map((col) => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('tenant_id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('traits');
      expect(columnNames).toContain('created_at');
    });

    it('should create all required columns in messages table', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      const result = rawDb.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>;
      const columnNames = result.map((col) => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('session_id');
      expect(columnNames).toContain('role');
      expect(columnNames).toContain('content');
      expect(columnNames).toContain('tool_name');
      expect(columnNames).toContain('tool_call_id');
      expect(columnNames).toContain('arguments');
      expect(columnNames).toContain('result');
      expect(columnNames).toContain('metadata');
      expect(columnNames).toContain('created_at');
    });

    it('should enforce NOT NULL constraint on sessions.tenant_id', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      expect(() => {
        rawDb.exec(`INSERT INTO sessions (id, created_at) VALUES ('test-id', '2024-01-01T00:00:00Z')`);
      }).toThrow();
    });

    it('should enforce NOT NULL constraint on messages.role', () => {
      initDatabase({ path: ':memory:', runMigrations: false });
      const rawDb = getRawDatabase();
      
      // First insert a session
      rawDb.exec(`INSERT INTO sessions (id, tenant_id, created_at) VALUES ('session-1', 'test-tenant', '2024-01-01T00:00:00Z')`);
      
      expect(() => {
        rawDb.exec(`INSERT INTO messages (id, session_id, content, created_at) VALUES ('msg-1', 'session-1', 'test', '2024-01-01T00:00:00Z')`);
      }).toThrow();
    });
  });
});

