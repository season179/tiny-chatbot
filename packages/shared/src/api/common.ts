import { z } from 'zod';

// Shared chat message roles
export const chatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

const chatMessageBaseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.unknown()).optional()
});

const chatTextMessageBaseSchema = chatMessageBaseSchema.extend({
  content: z.string()
});

export const chatSystemMessageSchema = chatTextMessageBaseSchema.extend({
  role: z.literal('system')
});
export type ChatSystemMessage = z.infer<typeof chatSystemMessageSchema>;

export const chatUserMessageSchema = chatTextMessageBaseSchema.extend({
  role: z.literal('user')
});
export type ChatUserMessage = z.infer<typeof chatUserMessageSchema>;

export const chatAssistantMessageSchema = chatTextMessageBaseSchema.extend({
  role: z.literal('assistant')
});
export type ChatAssistantMessage = z.infer<typeof chatAssistantMessageSchema>;
export type ChatTextMessage =
  | ChatSystemMessage
  | ChatUserMessage
  | ChatAssistantMessage;

export const chatToolInvocationResultSchema = z.object({
  status: z.enum(['success', 'error', 'timeout']).optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type ChatToolInvocationResult = z.infer<typeof chatToolInvocationResultSchema>;

export const chatToolMessageSchema = chatMessageBaseSchema.extend({
  role: z.literal('tool'),
  toolName: z.string(),
  toolCallId: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  result: chatToolInvocationResultSchema.optional(),
  content: z.string().optional()
});
export type ChatToolMessage = z.infer<typeof chatToolMessageSchema>;

export const chatMessageSchema = z.discriminatedUnion('role', [
  chatSystemMessageSchema,
  chatUserMessageSchema,
  chatAssistantMessageSchema,
  chatToolMessageSchema
]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Session with messages
export const chatSessionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string().optional(),
  traits: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  messages: z.array(chatMessageSchema)
});
export type ChatSession = z.infer<typeof chatSessionSchema>;
