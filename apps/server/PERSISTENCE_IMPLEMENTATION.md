# SQLite Session Persistence Implementation

## Overview

Successfully implemented persistent session storage using SQLite and Drizzle ORM. All conversation history now persists across server restarts.

## Implementation Details

### Architecture

```
ConversationService
    ↓
SqliteSessionStore (implements SessionStore interface)
    ↓
Drizzle ORM
    ↓
SQLite Database (./data/sessions.db)
```

### Database Schema

**Sessions Table:**
- `id` (TEXT, PRIMARY KEY) - Unique session identifier
- `tenant_id` (TEXT, NOT NULL) - Tenant identifier
- `user_id` (TEXT, NULLABLE) - Optional user identifier
- `traits` (TEXT, NULLABLE) - JSON-stringified user traits/metadata
- `created_at` (TEXT, NOT NULL) - ISO timestamp

**Messages Table:**
- `id` (TEXT, PRIMARY KEY) - Unique message identifier
- `session_id` (TEXT, NOT NULL, FOREIGN KEY → sessions.id ON DELETE CASCADE)
- `role` (TEXT, NOT NULL) - Message role: 'system', 'user', or 'assistant'
- `content` (TEXT, NOT NULL) - Message content
- `created_at` (TEXT, NOT NULL) - ISO timestamp
- Index on `session_id` for fast lookups

### Files Created

1. **`src/db/schema.ts`** - Drizzle schema definitions
2. **`src/db/index.ts`** - Database connection and initialization
3. **`src/repositories/SqliteSessionStore.ts`** - SQLite implementation of SessionStore
4. **`src/repositories/SqliteSessionStore.test.ts`** - Comprehensive test suite (15 tests)
5. **`drizzle.config.ts`** - Drizzle Kit configuration
6. **`drizzle/0000_amusing_rafael_vega.sql`** - Initial migration
7. **`test-persistence.sh`** - Manual persistence verification script

### Files Modified

1. **`src/server.ts`** - Switched from InMemorySessionStore to SqliteSessionStore, added database initialization and cleanup
2. **`src/config.ts`** - Added `DATABASE_PATH` configuration option
3. **`.env.example`** - Added DATABASE_PATH documentation
4. **`.env`** - Added DATABASE_PATH=./data/sessions.db
5. **`package.json`** - Added db:generate, db:migrate, db:studio scripts

## Usage

### Development

```bash
# Server automatically creates and uses SQLite database
pnpm dev

# Database is created at ./data/sessions.db by default
```

### Configuration

Set `DATABASE_PATH` in `.env` or environment:

```bash
# Use default location
DATABASE_PATH=./data/sessions.db

# Use custom location
DATABASE_PATH=/var/lib/chatbot/sessions.db

# Use in-memory (testing only - data will not persist)
DATABASE_PATH=:memory:
```

### Database Management

```bash
# Generate new migration after schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio (visual database browser)
pnpm db:studio
```

### Testing Persistence

```bash
# Run automated tests
pnpm test

# Run manual persistence test
./test-persistence.sh
```

## Test Results

✅ **All 85 tests passing**

- 15 new SqliteSessionStore tests
- All existing tests continue to pass
- Tests use in-memory SQLite (`:memory:`) for isolation
- No test database cleanup required

### Test Coverage

- ✅ Session creation (with/without optional fields)
- ✅ Session retrieval
- ✅ Message appending
- ✅ Message ordering
- ✅ Error handling (non-existent sessions)
- ✅ Complex traits objects (nested JSON)
- ✅ Long message content (10k characters)
- ✅ System/user/assistant role messages
- ✅ Many messages per session (50+)

## Key Features

### Automatic Table Creation

The database utility automatically creates tables when:
- Using in-memory databases (tests)
- `runMigrations` is false (default for development)

This eliminates the need to run migrations manually during development.

### Graceful Shutdown

Server properly closes database connections on shutdown via Fastify's `onClose` hook.

### Transaction Safety

All database operations use Drizzle ORM's query builder, which handles:
- SQL injection prevention
- Type safety
- Automatic parameterization

### Cascade Deletion

Foreign key constraint ensures messages are automatically deleted when a session is deleted.

## Migration Strategy

### For Development
Tables are auto-created on first run. No manual migration needed.

### For Production
Run migrations explicitly:

```bash
# Generate migrations after schema changes
pnpm db:generate

# Apply migrations to production database
DATABASE_PATH=/path/to/prod.db pnpm db:migrate
```

## Performance Considerations

### Indexes
- `messages_session_id_idx` - Fast message lookups by session

### Query Patterns
- `getSession()` executes 2 queries: 1 for session, 1 for messages
- `appendMessage()` executes 2 queries: 1 to check existence, 1 to insert
- `createSession()` executes 1 query

### Optimization Opportunities (Future)
- Add connection pooling for concurrent requests
- Implement query result caching
- Add pagination for sessions with many messages
- Consider write-ahead logging (WAL) mode for better concurrency

## Comparison: InMemorySessionStore vs SqliteSessionStore

| Feature | InMemorySessionStore | SqliteSessionStore |
|---------|---------------------|-------------------|
| Persistence | ❌ Lost on restart | ✅ Persists across restarts |
| Scalability | ❌ Single process only | ✅ Can scale horizontally with shared DB |
| Memory Usage | ⚠️ Grows unbounded | ✅ Fixed memory footprint |
| Performance | ✅ Fastest (in-memory) | ⚠️ Slightly slower (disk I/O) |
| Testing | ✅ Simple | ✅ Simple (uses :memory:) |
| Production Ready | ❌ No | ✅ Yes |

## Next Steps

See `INTEGRATION_PLAN.md` for remaining Phase 2 tasks:

- **Phase 2.2**: System Instructions & Prompts
- **Phase 2.3**: Error Handling & Resilience
- **Phase 2.4**: Context Management
- **Phase 2.5**: Advanced Features

## Troubleshooting

### Database file not created
- Check `DATABASE_PATH` in `.env`
- Ensure parent directory exists (auto-created by default)
- Check file permissions

### Tests failing
- Ensure `better-sqlite3` compiled correctly for your platform
- Try reinstalling: `pnpm install --force`

### Migration errors
- Ensure Drizzle Kit is installed: `pnpm add -D drizzle-kit`
- Check `drizzle.config.ts` path is correct
- Verify schema matches migration files

## References

- Drizzle ORM Docs: https://orm.drizzle.team
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- SQLite: https://www.sqlite.org/docs.html