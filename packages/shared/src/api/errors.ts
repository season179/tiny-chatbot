import { z } from 'zod';

// Error response format
export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional()
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// Standard error codes
export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';