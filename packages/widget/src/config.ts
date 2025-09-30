export interface WidgetConfig {
  apiBaseUrl: string;
  tenantId: string;
  userId?: string;
  traits?: Record<string, unknown>;
}

let globalConfig: WidgetConfig | null = null;

export function setConfig(config: WidgetConfig): void {
  globalConfig = config;
}

export function getConfig(): WidgetConfig {
  if (!globalConfig) {
    throw new Error('Widget config not initialized. Call setConfig() before using the widget.');
  }
  return globalConfig;
}