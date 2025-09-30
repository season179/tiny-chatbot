import { z } from 'zod';

// Chat message roles
export const chatRoleSchema = z.enum(['system', 'user', 'assistant']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

// Chat message
export const chatMessageSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  createdAt: z.string()
});
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