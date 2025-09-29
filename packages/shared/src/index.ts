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
