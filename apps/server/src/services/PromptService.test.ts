import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptService, PromptServiceError, resetPromptService } from './PromptService.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PromptService', () => {
  const testConfigDir = resolve(process.cwd(), 'test-prompts');
  const testConfigPath = resolve(testConfigDir, 'prompts.json');

  beforeEach(() => {
    resetPromptService();
    mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    resetPromptService();
    rmSync(testConfigDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should load prompts from the default path', () => {
      const service = new PromptService();
      expect(service).toBeDefined();
      expect(service.getDefaultPrompt()).toBeTruthy();
    });

    it('should load prompts from a custom path', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getDefaultPrompt()).toBe('Default prompt');
      expect(service.getPromptForTenant('tenant-1')).toBe('Tenant 1 prompt');
    });

    it('should throw error if config file does not exist', () => {
      expect(() => {
        new PromptService('/nonexistent/prompts.json');
      }).toThrow(PromptServiceError);
    });

    it('should throw error if config is invalid JSON', () => {
      writeFileSync(testConfigPath, 'invalid json {{{');

      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow(PromptServiceError);
    });

    it('should throw error if _default key is missing', () => {
      const config = {
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow(PromptServiceError);
      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow('Prompts config must have a "_default" key');
    });

    it('should throw error if _default is empty string', () => {
      const config = {
        _default: '   '
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow(PromptServiceError);
      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow('Default prompt must be a non-empty string');
    });

    it('should throw error if _default is not a string', () => {
      const config = {
        _default: 123
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      expect(() => {
        new PromptService(testConfigPath);
      }).toThrow(PromptServiceError);
    });
  });

  describe('getPromptForTenant', () => {
    it('should return tenant-specific prompt when available', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt',
        'tenant-2': 'Tenant 2 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getPromptForTenant('tenant-1')).toBe('Tenant 1 prompt');
      expect(service.getPromptForTenant('tenant-2')).toBe('Tenant 2 prompt');
    });

    it('should return default prompt when tenant-specific prompt is not available', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getPromptForTenant('nonexistent-tenant')).toBe('Default prompt');
    });

    it('should return default prompt for _default key', () => {
      const config = {
        _default: 'Default prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getPromptForTenant('_default')).toBe('Default prompt');
    });
  });

  describe('getDefaultPrompt', () => {
    it('should return the default prompt', () => {
      const config = {
        _default: 'This is the default prompt',
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getDefaultPrompt()).toBe('This is the default prompt');
    });
  });

  describe('hasTenantPrompt', () => {
    it('should return true when tenant has custom prompt', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.hasTenantPrompt('tenant-1')).toBe(true);
    });

    it('should return false when tenant does not have custom prompt', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.hasTenantPrompt('nonexistent-tenant')).toBe(false);
    });

    it('should return false for _default key', () => {
      const config = {
        _default: 'Default prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.hasTenantPrompt('_default')).toBe(false);
    });
  });

  describe('getTenantIds', () => {
    it('should return all tenant IDs excluding _default', () => {
      const config = {
        _default: 'Default prompt',
        'tenant-1': 'Tenant 1 prompt',
        'tenant-2': 'Tenant 2 prompt',
        'tenant-3': 'Tenant 3 prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      const tenantIds = service.getTenantIds();

      expect(tenantIds).toHaveLength(3);
      expect(tenantIds).toContain('tenant-1');
      expect(tenantIds).toContain('tenant-2');
      expect(tenantIds).toContain('tenant-3');
      expect(tenantIds).not.toContain('_default');
    });

    it('should return empty array when only _default is present', () => {
      const config = {
        _default: 'Default prompt'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getTenantIds()).toEqual([]);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle multiline prompts', () => {
      const config = {
        _default: `You are a helpful assistant.
You should:
- Be polite
- Be concise
- Be accurate`
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getDefaultPrompt()).toContain('You are a helpful assistant');
      expect(service.getDefaultPrompt()).toContain('Be polite');
    });

    it('should handle prompts with special characters', () => {
      const config = {
        _default: 'You are a helpful assistant! 🤖 Use emojis: ✅ ❌'
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getDefaultPrompt()).toBe('You are a helpful assistant! 🤖 Use emojis: ✅ ❌');
    });

    it('should handle long prompts', () => {
      const longPrompt = 'A'.repeat(10000);
      const config = {
        _default: longPrompt
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const service = new PromptService(testConfigPath);
      expect(service.getDefaultPrompt().length).toBe(10000);
    });
  });
});