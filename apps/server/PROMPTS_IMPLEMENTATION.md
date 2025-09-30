# System Instructions & Prompts Implementation

## Overview

Successfully implemented tenant-specific system prompts that allow different conversation personalities and behaviors per tenant. System prompts are dynamically prepended to conversations without being persisted to the database.

## Implementation Details

### Architecture

```
User Message
    ↓
ConversationService
    ↓ (prepends system prompt)
PromptService.getPromptForTenant(tenantId)
    ↓
[System Message, ...User Messages, ...Assistant Messages]
    ↓
OpenAIService (converts to OpenAI format)
    ↓
OpenAI Responses API
```

### How It Works

1. **PromptService loads prompts** from `config/prompts.json` on server startup
2. **ConversationService prepends system prompt** to conversation history before each API call
3. **System prompts are NOT persisted** - they're added dynamically for each request
4. **Tenant-specific or default** - each tenant can have a custom prompt, or use the default

### Prompts Configuration

**File:** `apps/server/config/prompts.json`

```json
{
  "_default": "You are a helpful, friendly, and professional AI assistant...",
  "demo-tenant": "You are a friendly customer support assistant for our demo application...",
  "support-tenant": "You are a technical support specialist...",
  "sales-tenant": "You are a knowledgeable sales assistant..."
}
```

**Structure:**
- `_default` (required) - Fallback prompt used when no tenant-specific prompt exists
- `tenant-id` (optional) - Custom prompt for specific tenant

### Files Created

1. **`config/prompts.json`** - Prompt configuration file
2. **`src/services/PromptService.ts`** - Service to load and manage prompts
3. **`src/services/PromptService.test.ts`** - Comprehensive test suite (19 tests)

### Files Modified

1. **`src/services/ConversationService.ts`** - Added `prependSystemPrompt()` method
2. **`src/services/OpenAIService.ts`** - Added 'system' role support in message conversion
3. **`src/server.ts`** - Wired PromptService with graceful fallback

## API

### PromptService

```typescript
const promptService = new PromptService(promptsPath?);

// Get prompt for specific tenant (falls back to _default)
const prompt = promptService.getPromptForTenant('tenant-123');

// Get default prompt
const defaultPrompt = promptService.getDefaultPrompt();

// Check if tenant has custom prompt
const hasCustom = promptService.hasTenantPrompt('tenant-123');

// Get all tenant IDs (excluding _default)
const tenantIds = promptService.getTenantIds();
```

### Singleton Pattern

```typescript
import { getPromptService } from './services/PromptService.js';

const promptService = getPromptService(); // Returns cached instance
```

## Usage

### Basic Setup

1. **Create `config/prompts.json`:**

```json
{
  "_default": "You are a helpful AI assistant.",
  "my-app": "You are a helpful assistant for MyApp."
}
```

2. **Server automatically loads prompts on startup**

3. **System prompts are automatically prepended to all conversations**

### Adding New Prompts

Edit `config/prompts.json` and restart the server:

```json
{
  "_default": "Default behavior",
  "new-tenant-id": "Custom behavior for new tenant"
}
```

### Testing Different Prompts

```bash
# Create session for tenant with custom prompt
curl -X POST http://localhost:4000/api/session \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-tenant"}'

# Send message (will use "demo-tenant" system prompt)
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "message": "Hello!"}'
```

## Test Results

✅ **All 104 tests passing**

- 19 new PromptService tests
- All existing tests continue to pass
- Tests cover error cases, edge cases, and real-world scenarios

### Test Coverage

- ✅ Loading from default path
- ✅ Loading from custom path
- ✅ Error handling (missing file, invalid JSON, missing _default)
- ✅ Tenant-specific prompts
- ✅ Fallback to default prompt
- ✅ Multiline prompts
- ✅ Special characters and emojis
- ✅ Long prompts (10k characters)
- ✅ hasTenantPrompt() and getTenantIds()

## Key Features

### Optional Integration

PromptService is optional - the server gracefully handles missing configuration:

```typescript
// Server logs on startup:
// ✅ "PromptService initialized with custom prompts"
// ⚠️  "PromptService not initialized - using default behavior without system prompts"
```

### No Database Persistence

System prompts are **not stored in the database**. They're added dynamically to each API call:

```typescript
// Messages in database: [user, assistant, user, assistant, ...]
// Messages sent to OpenAI: [system, user, assistant, user, assistant, ...]
```

**Benefits:**
- Change prompts without database migrations
- No storage overhead
- Easy A/B testing
- Consistent prompts across sessions

### Backward Compatible

ConversationService works with or without PromptService:

```typescript
// With prompts
const service = new ConversationService(store, openAI, promptService);

// Without prompts (existing behavior)
const service = new ConversationService(store, openAI);
```

### Smart Prepending

System prompt is only prepended if:
1. PromptService is available
2. There's no existing system message at the start

```typescript
private prependSystemPrompt(messages: ChatMessage[], tenantId: string): ChatMessage[] {
  if (!this.promptService) return messages;

  const hasSystemMessage = messages.length > 0 && messages[0].role === 'system';
  if (hasSystemMessage) return messages;

  const systemPrompt = this.promptService.getPromptForTenant(tenantId);
  return [{ role: 'system', content: systemPrompt, ... }, ...messages];
}
```

## Best Practices

### Writing Effective System Prompts

1. **Be specific about the assistant's role**
   ```
   ✅ "You are a technical support specialist for Acme Corp."
   ❌ "You are helpful."
   ```

2. **Include behavioral guidelines**
   ```
   ✅ "Always be patient and empathetic. Provide step-by-step instructions."
   ❌ "Help users."
   ```

3. **Set tone and style**
   ```
   ✅ "Maintain a professional yet friendly tone. Use clear, concise language."
   ❌ "Be nice."
   ```

4. **Define boundaries**
   ```
   ✅ "If you don't know the answer, say so and suggest contacting support."
   ❌ "Answer all questions."
   ```

### Prompt Organization

For multiple tenants with similar needs, consider:

```json
{
  "_default": "Base behavior for all tenants",
  "tenant-type-support": "Support-focused prompt for multiple tenants",
  "tenant-type-sales": "Sales-focused prompt for multiple tenants",
  "vip-tenant-123": "Highly customized prompt for specific VIP tenant"
}
```

### Testing Prompts

1. **Test with edge cases:**
   - Very long prompts
   - Prompts with special characters
   - Multiline prompts
   - Empty/whitespace-only prompts (validation prevents this)

2. **Verify behavior:**
   - Create session with tenant ID
   - Send messages
   - Verify assistant follows prompt guidelines

3. **A/B test different prompts:**
   - Create two tenants with different prompts
   - Compare conversation quality

## Advanced Usage

### Dynamic Prompt Loading

Currently prompts are loaded once on startup. For dynamic reloading:

```typescript
// Future enhancement idea:
promptService.reload(); // Reload from file
promptService.setPrompt('tenant-id', 'new prompt'); // Set in-memory
```

### Prompt Variables

Future enhancement for dynamic content:

```json
{
  "_default": "You are a helpful assistant for {{company_name}}. Contact: {{support_email}}"
}
```

### Prompt Versioning

Track prompt changes over time:

```json
{
  "_default": {
    "version": "1.0",
    "updated": "2025-09-30",
    "prompt": "Your system prompt here"
  }
}
```

## Troubleshooting

### Prompts not being applied

1. **Check server logs for PromptService initialization**
   ```
   ✅ "PromptService initialized with custom prompts"
   ```

2. **Verify prompts.json exists**
   ```bash
   ls config/prompts.json
   ```

3. **Validate JSON syntax**
   ```bash
   cat config/prompts.json | jq .
   ```

4. **Ensure _default key exists**

### Prompts not changing behavior

1. **Verify tenant ID matches configuration**
2. **Check if prompt is specific enough**
3. **Test with more explicit instructions**
4. **Monitor OpenAI API calls in logs**

### Server won't start

1. **Check for JSON syntax errors in prompts.json**
2. **Ensure _default key exists and is non-empty**
3. **Verify file path is correct**

## Performance Considerations

### Memory Usage

- Prompts are loaded once on startup
- Minimal memory footprint (<1KB per prompt typically)
- No per-request file I/O

### Request Latency

- No impact on request latency
- Prompts are prepended in-memory (microseconds)
- No additional API calls

### Token Usage

- System prompts count toward input tokens
- Typical prompt: 20-100 tokens
- Sent with every message (cannot be cached by OpenAI)

**Optimization tips:**
- Keep prompts concise
- Remove unnecessary words
- Test effectiveness vs length

## Next Steps

See `INTEGRATION_PLAN.md` for remaining Phase 2 tasks:

- **Phase 2.3**: Error Handling & Resilience
- **Phase 2.4**: Context Management
- **Phase 2.5**: Advanced Features

## References

- OpenAI System Messages: https://platform.openai.com/docs/guides/prompt-engineering
- Prompt Engineering Guide: https://www.promptingguide.ai/
- Drizzle ORM: https://orm.drizzle.team/