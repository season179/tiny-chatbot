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

### Writing Effective System Prompts for GPT-5

**GPT-5 is a reasoning model** - it generates an internal chain of thought before responding. System prompts should be structured and explicit to leverage this capability.

#### Recommended Structure

```
[IDENTITY & METADATA]
- Model identification (GPT-5)
- Knowledge cutoff date
- Current date

[LANGUAGE & LOCALIZATION]
- Language matching requirements
- Regional considerations

[ROLE & PERSONALITY]
- Clear role definition
- Tone and communication style

[RESPONSE GUIDELINES]
- Conciseness requirements
- Format preferences
- Structure expectations

[TOOLS] (if applicable)
- Available tools list
- When to use tools
- Tool call preambles

[UNCERTAINTY & SAFETY]
- How to handle uncertainty
- Anti-hallucination directives
- Content restrictions

[BEHAVIOR]
- General behavioral guidelines
```

#### Key Principles for GPT-5

1. **Be Explicit and Structured**
   ```
   ✅ Use headers (# Tools, # Language, # Behavior)
   ✅ Use bullet points for clarity
   ✅ Separate concerns into sections
   ❌ Don't use vague, unstructured text
   ```

2. **Include Tool Preambles**
   ```
   ✅ "Before calling a tool, explain why: 'I will use [tool] to [reason]'"
   ❌ Don't let the model call tools without explanation
   ```

3. **Define Uncertainty Handling**
   ```
   ✅ "If uncertain, say 'I cannot answer that question'"
   ✅ "NEVER make up information or hallucinate facts"
   ❌ "Try your best to answer all questions"
   ```

4. **Set Clear Boundaries**
   ```
   ✅ "If you don't know the answer, explicitly say so"
   ✅ "Escalate complex problems to: [contact info]"
   ❌ "Help with everything"
   ```

5. **Language Matching (for multilingual apps)**
   ```
   ✅ "ALWAYS respond in the same language the user uses"
   ✅ Include examples for each language
   ❌ Assume a single language
   ```

6. **Conciseness for Limited UI**
   ```
   ✅ "Keep responses CONCISE - the UI space is limited"
   ✅ "Use structured formats (bullet points, numbered lists)"
   ❌ Allow verbose, lengthy responses
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
- GPT-5 prompts are more structured and longer (typically 100-300 tokens)
- Sent with every message
- Trade-off: longer prompts provide better control and reduce hallucination

**Optimization tips:**
- Keep prompts structured but concise
- Use headers and bullet points for clarity
- Test effectiveness vs length
- More tokens for system prompt = fewer wasted tokens from incorrect responses

### GPT-5 Specific Features

#### Reasoning Effort Control (API Parameter)
GPT-5's reasoning depth is controlled via API parameters, not system prompts:
- `reasoning: { effort: "minimal" | "low" | "medium" | "high" }`
- Current default: `"minimal"` for fast responses
- System prompts should complement, not override, this setting

#### Verbosity Control (API Parameter)
Output length is controlled via:
- `text: { verbosity: "low" | "medium" | "high" }`
- Current default: `"low"` for concise responses
- System prompts can emphasize conciseness but can't override the parameter

#### Tool Usage with Preambles
GPT-5 benefits from **preambles** - explaining tool use before calling:
- Improves tool-calling accuracy
- Provides transparency to users
- Enhances debuggability

**Implementation:**
```json
{
  "_default": "...
  # Tools
  Before calling a tool, explain why: 'I will use [tool] to [reason]'
  
  Available tools:
  - cat: Read file contents
  - ls: List directory contents
  - grep/rg: Search patterns
  ..."
}
```

#### Anti-Hallucination Directives
GPT-5 is trained to be helpful, which can lead to making up answers. Combat this:
```
✅ "If uncertain, explicitly say 'I cannot answer that question'"
✅ "NEVER make up information or hallucinate facts"
✅ "Do not reproduce copyrighted material"
```

#### Multilingual Language Matching
For applications serving multiple languages:
```
✅ "ALWAYS respond in the same language the user uses"
✅ Provide examples: "If user writes in Bahasa Indonesia, respond in Bahasa Indonesia"
✅ Include template responses in each language for uncertainty
```

## Current Prompts

All prompts in `config/prompts.json` follow GPT-5 best practices:

### Common Features Across All Tenants

1. **GPT-5 Identity & Metadata**
   - Model identification
   - Current date: `{{CURRENT_DATE}}` (dynamically computed)

2. **Language Matching for Indonesian Company**
   - ALWAYS respond in user's language (Bahasa Indonesia or English)
   - Bilingual uncertainty responses provided

3. **Conciseness Requirements**
   - Optimized for small UI
   - Formal tone
   - Structured formats (bullet points, numbered lists)

4. **Anti-Hallucination**
   - Explicit instructions to say "cannot answer" when uncertain
   - NEVER make up information

5. **Tool Integration**
   - Shell tools: cat, ls, grep, rg, head, tail, pwd, wc, which
   - Tool preambles required before calling
   - Context-appropriate tool usage guidelines

6. **Safety Directives**
   - No copyrighted material reproduction
   - Polite refusal of unsafe requests

### Tenant-Specific Adaptations

- **_default**: General-purpose assistant
- **demo-tenant**: Focus on demonstrating capabilities
- **support-tenant**: Technical troubleshooting with escalation paths
- **sales-tenant**: Consultative approach with information verification

## Prompt Template for New Tenants

When adding new tenant prompts, use this template:

```json
{
  "new-tenant-id": "You are an AI assistant powered by GPT-5 for an Indonesian company.\nCurrent date: {{CURRENT_DATE}}\n\n# Language\nALWAYS respond in the same language the user uses. If the user writes in Bahasa Indonesia, respond in Bahasa Indonesia. If they write in English, respond in English.\n\n# Role\n[Define specific role: support specialist, sales assistant, product expert, etc.]\n[Describe personality and approach]\n\n# Response Guidelines\n- Keep responses CONCISE and FORMAL - the UI space is limited\n- [Add role-specific guidelines]\n- [Format preferences]\n- [Style requirements]\n\n# Tools\n[Optional: Define tool usage if relevant to this tenant]\nYou have access to file tools (cat, ls, grep, rg, head, tail, pwd, wc, which).\n\nBefore using tools, explain: \"Saya akan [action]\" (ID) or \"I will [action]\" (EN)\n\nUse tools when:\n- [Condition 1]\n- [Condition 2]\n\n# Uncertainty & Safety\n- If uncertain, say \"Saya tidak dapat menjawab pertanyaan tersebut\" (ID) or \"I cannot answer that question\" (EN)\n- NEVER make up information or hallucinate facts\n- [Add role-specific safety guidelines]\n- [Escalation paths if applicable]\n\n# Behavior\n- [Additional behavioral guidelines]\n- [Domain-specific requirements]"
}
```

### Dynamic Values

The PromptService automatically injects dynamic values:
- `{{CURRENT_DATE}}` - Replaced with current date in YYYY-MM-DD format

### Checklist for New Prompts

- [ ] GPT-5 metadata included (model, current date with {{CURRENT_DATE}} placeholder)
- [ ] Language matching explicitly stated with examples
- [ ] Conciseness requirements for limited UI
- [ ] Anti-hallucination directives included
- [ ] Uncertainty handling with bilingual templates
- [ ] Tool usage guidelines (if applicable)
- [ ] Tool preambles required
- [ ] Safety directives appropriate for use case
- [ ] Role clearly defined
- [ ] Escalation paths specified (if applicable)
- [ ] Tested with both Bahasa Indonesia and English inputs
- [ ] Verified responses are concise and properly formatted

## Next Steps

See `INTEGRATION_PLAN.md` for remaining Phase 2 tasks:

- **Phase 2.3**: Error Handling & Resilience
- **Phase 2.4**: Context Management
- **Phase 2.5**: Advanced Features

## References

### GPT-5 & Responses API
- GPT-5 Documentation: https://platform.openai.com/docs/guides/gpt-5
- GPT-5 Prompting Guide: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
- Responses API vs Chat Completions: https://platform.openai.com/docs/guides/responses-vs-chat-completions
- OpenAI Responses API: See `knowledge-base/Responses-API-Documentation/`

### Prompt Engineering
- OpenAI Prompt Engineering: https://platform.openai.com/docs/guides/prompt-engineering
- Prompt Engineering Guide: https://www.promptingguide.ai/

### Technical
- Drizzle ORM: https://orm.drizzle.team/
- Function Calling: See `knowledge-base/function-calling-documentation.md`