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
    role: text('role').notNull(), // 'system' | 'user' | 'assistant' | 'tool'
    content: text('content').notNull(),
    toolName: text('tool_name'),
    toolCallId: text('tool_call_id'),
    arguments: text('arguments'), // JSON stringified tool arguments
    result: text('result'), // JSON stringified tool results
    metadata: text('metadata'), // JSON stringified message metadata
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    sessionIdIdx: index('messages_session_id_idx').on(table.sessionId)
  })
);
