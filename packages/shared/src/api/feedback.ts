import { z } from 'zod';

// POST /api/feedback - Request
export const feedbackRequestSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  score: z.enum(['up', 'down']),
  comments: z.string().max(1000).optional()
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

// POST /api/feedback - Response
export const feedbackResponseSchema = z.object({
  status: z.literal('RECEIVED')
});
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;