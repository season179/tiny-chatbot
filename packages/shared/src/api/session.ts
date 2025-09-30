import { z } from 'zod';

// POST /api/session - Request
export const createSessionRequestSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().optional(),
  traits: z.record(z.unknown()).optional()
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

// POST /api/session - Response
export const createSessionResponseSchema = z.object({
  sessionId: z.string(),
  tenantId: z.string(),
  userId: z.string().optional(),
  createdAt: z.string()
});
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;