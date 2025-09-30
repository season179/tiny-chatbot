import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id'),
  traits: text('traits'), // JSON stringified
  createdAt: text('created_at').notNull()
});

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'system' | 'user' | 'assistant'
    content: text('content').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    sessionIdIdx: index('messages_session_id_idx').on(table.sessionId)
  })
);