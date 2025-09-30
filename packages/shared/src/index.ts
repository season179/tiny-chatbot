// Widget-specific types
export interface TenantMetadata {
  id: string;
  name: string;
  defaultLocale: string;
}

export interface ChatContextPayload {
  userId?: string;
  sessionId: string;
  traits?: Record<string, unknown>;
}

export interface WidgetMountEvent {
  tenant: TenantMetadata;
  context: ChatContextPayload;
  timestamp: string;
}

// API Common types
export * from './api/common.js';

// API Session types
export * from './api/session.js';

// API Chat types
export * from './api/chat.js';

// API Feedback types
export * from './api/feedback.js';

// API Error types
export * from './api/errors.js';

// API Client
export * from './client/api-client.js';
