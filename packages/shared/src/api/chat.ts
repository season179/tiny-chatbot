import { z } from 'zod';
import { chatMessageSchema } from './common.js';

// POST /api/chat - Request
export const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// POST /api/chat - Response
export const chatResponseSchema = z.object({
  sessionId: z.string(),
  message: chatMessageSchema
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

// POST /api/chat/stream - Request
export const streamChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1)
});
export type StreamChatRequest = z.infer<typeof streamChatRequestSchema>;

// POST /api/chat/stream - SSE Event Types
export const streamChunkEventSchema = z.object({
  type: z.literal('chunk'),
  data: z.string()
});
export type StreamChunkEvent = z.infer<typeof streamChunkEventSchema>;

export const streamCompletedEventSchema = z.object({
  type: z.literal('completed'),
  message: chatMessageSchema
});
export type StreamCompletedEvent = z.infer<typeof streamCompletedEventSchema>;

export const streamErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.string()
});
export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>;

export const streamEventSchema = z.discriminatedUnion('type', [
  streamChunkEventSchema,
  streamCompletedEventSchema,
  streamErrorEventSchema
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;