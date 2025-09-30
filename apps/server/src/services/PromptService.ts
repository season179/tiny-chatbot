import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PromptConfig {
  _default: string;
  [tenantId: string]: string;
}

export class PromptServiceError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'PromptServiceError';
  }
}

export class PromptService {
  private prompts: PromptConfig;

  constructor(promptsPath?: string) {
    const configPath = promptsPath || resolve(process.cwd(), 'config', 'prompts.json');
    this.prompts = this.loadPrompts(configPath);
  }

  /**
   * Get the system prompt for a specific tenant.
   * Falls back to the default prompt if tenant-specific prompt is not found.
   */
  getPromptForTenant(tenantId: string): string {
    return this.prompts[tenantId] || this.prompts._default;
  }

  /**
   * Get the default system prompt.
   */
  getDefaultPrompt(): string {
    return this.prompts._default;
  }

  /**
   * Check if a tenant has a custom prompt.
   */
  hasTenantPrompt(tenantId: string): boolean {
    return tenantId in this.prompts && tenantId !== '_default';
  }

  /**
   * Get all available tenant IDs (excluding _default).
   */
  getTenantIds(): string[] {
    return Object.keys(this.prompts).filter((key) => key !== '_default');
  }

  private loadPrompts(configPath: string): PromptConfig {
    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(fileContent) as PromptConfig;

      if (!parsed._default) {
        throw new PromptServiceError('Prompts config must have a "_default" key');
      }

      if (typeof parsed._default !== 'string' || parsed._default.trim() === '') {
        throw new PromptServiceError('Default prompt must be a non-empty string');
      }

      return parsed;
    } catch (error) {
      if (error instanceof PromptServiceError) {
        throw error;
      }
      throw new PromptServiceError(`Failed to load prompts from ${configPath}`, error);
    }
  }
}

// Singleton instance for convenience
let promptServiceInstance: PromptService | null = null;

export function getPromptService(promptsPath?: string): PromptService {
  if (!promptServiceInstance) {
    promptServiceInstance = new PromptService(promptsPath);
  }
  return promptServiceInstance;
}

// For testing purposes only
export function resetPromptService(): void {
  promptServiceInstance = null;
}