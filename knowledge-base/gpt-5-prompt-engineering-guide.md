# GPT-5 Prompt Engineering Guide for Tiny-Chatbot

This guide documents best practices for writing effective system prompts for GPT-5 reasoning models in the tiny-chatbot application.

## Understanding GPT-5

**GPT-5 is a reasoning model** - it generates an internal chain of thought before responding. System prompts should be structured and explicit to leverage this capability.

## Recommended Prompt Structure

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

## Key Principles for GPT-5

### 1. Be Explicit and Structured

```
✅ Use headers (# Tools, # Language, # Behavior)
✅ Use bullet points for clarity
✅ Separate concerns into sections
❌ Don't use vague, unstructured text
```

### 2. Include Tool Preambles

```
✅ "Before calling a tool, explain why: 'I will use [tool] to [reason]'"
❌ Don't let the model call tools without explanation
```

**Why?** Tool preambles improve accuracy, provide transparency to users, and enhance debuggability.

### 3. Define Uncertainty Handling

```
✅ "If uncertain, say 'I cannot answer that question'"
✅ "NEVER make up information or hallucinate facts"
❌ "Try your best to answer all questions"
```

### 4. Set Clear Boundaries

```
✅ "If you don't know the answer, explicitly say so"
✅ "Escalate complex problems to: [contact info]"
❌ "Help with everything"
```

### 5. Language Matching (for multilingual apps)

```
✅ "ALWAYS respond in the same language the user uses"
✅ Include examples for each language
❌ Assume a single language
```

### 6. Conciseness for Limited UI

```
✅ "Keep responses CONCISE - the UI space is limited"
✅ "Use structured formats (bullet points, numbered lists)"
❌ Allow verbose, lengthy responses
```

## GPT-5 Specific Features

### Reasoning Effort Control (API Parameter)
GPT-5's reasoning depth is controlled via API parameters, not system prompts:
- `reasoning: { effort: "minimal" | "low" | "medium" | "high" }`
- Current default: `"minimal"` for fast responses
- System prompts should complement, not override, this setting

### Verbosity Control (API Parameter)
Output length is controlled via:
- `text: { verbosity: "low" | "medium" | "high" }`
- Current default: `"low"` for concise responses
- System prompts can emphasize conciseness but can't override the parameter

### Tool Usage with Preambles
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

### Anti-Hallucination Directives
GPT-5 is trained to be helpful, which can lead to making up answers. Combat this:
```
✅ "If uncertain, explicitly say 'I cannot answer that question'"
✅ "NEVER make up information or hallucinate facts"
✅ "Do not reproduce copyrighted material"
```

### Multilingual Language Matching
For applications serving multiple languages:
```
✅ "ALWAYS respond in the same language the user uses"
✅ Provide examples: "If user writes in Bahasa Indonesia, respond in Bahasa Indonesia"
✅ Include template responses in each language for uncertainty
```

## Prompt Template for New Tenants

When adding new tenant prompts to `config/prompts.json`, use this template:

```json
{
  "new-tenant-id": "You are an AI assistant powered by GPT-5 for an Indonesian company.\nCurrent date: {{CURRENT_DATE}}\n\n# Language\nALWAYS respond in the same language the user uses. If the user writes in Bahasa Indonesia, respond in Bahasa Indonesia. If they write in English, respond in English.\n\n# Role\n[Define specific role: support specialist, sales assistant, product expert, etc.]\n[Describe personality and approach]\n\n# Response Guidelines\n- Keep responses CONCISE and FORMAL - the UI space is limited\n- [Add role-specific guidelines]\n- [Format preferences]\n- [Style requirements]\n\n# Tools\n[Optional: Define tool usage if relevant to this tenant]\nYou have access to file tools (cat, ls, grep, rg, head, tail, pwd, wc, which).\n\nBefore using tools, explain: \"Saya akan [action]\" (ID) or \"I will [action]\" (EN)\n\nUse tools when:\n- [Condition 1]\n- [Condition 2]\n\n# Uncertainty & Safety\n- If uncertain, say \"Saya tidak dapat menjawab pertanyaan tersebut\" (ID) or \"I cannot answer that question\" (EN)\n- NEVER make up information or hallucinate facts\n- [Add role-specific safety guidelines]\n- [Escalation paths if applicable]\n\n# Behavior\n- [Additional behavioral guidelines]\n- [Domain-specific requirements]"
}
```

## Dynamic Values

The PromptService automatically injects dynamic values:
- `{{CURRENT_DATE}}` - Replaced with current date in YYYY-MM-DD format

## Checklist for New Prompts

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

## Current Prompts in Tiny-Chatbot

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

## Best Practices Summary

### Writing Effective Prompts

1. **Structure is Key**: Use headers and bullet points for clarity
2. **Be Explicit**: Don't assume the model will infer your intent
3. **Include Examples**: Especially for language matching and format expectations
4. **Define Failure Modes**: Tell the model what to do when uncertain
5. **Test Thoroughly**: Try edge cases, multiple languages, long conversations

### Testing Prompts

1. **Test with edge cases:**
   - Very long prompts
   - Prompts with special characters
   - Multiline prompts
   - Empty/whitespace-only prompts (validation prevents this)

2. **Verify behavior:**
   - Create session with tenant ID
   - Send messages in different languages
   - Verify assistant follows prompt guidelines
   - Test tool usage if applicable

3. **A/B test different prompts:**
   - Create two tenants with different prompts
   - Compare conversation quality
   - Measure metrics: response time, accuracy, user satisfaction

## Performance Considerations

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

## References

### GPT-5 & Responses API
- GPT-5 Documentation: https://platform.openai.com/docs/guides/gpt-5
- GPT-5 Prompting Guide: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
- Responses API vs Chat Completions: https://platform.openai.com/docs/guides/responses-vs-chat-completions
- OpenAI Responses API: See `knowledge-base/Responses-API-Documentation/`

### Prompt Engineering
- OpenAI Prompt Engineering: https://platform.openai.com/docs/guides/prompt-engineering
- Prompt Engineering Guide: https://www.promptingguide.ai/

### Implementation
- PromptService: `apps/server/src/services/PromptService.ts`
- Prompt Configuration: `apps/server/config/prompts.json`
- Function Calling: See `knowledge-base/function-calling-documentation.md`

