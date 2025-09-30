import { describe, it, expect, beforeEach } from 'vitest';
import { ShellToolService, ShellToolError } from './ShellToolService.js';
import type { ToolsConfig } from '../config/toolsConfig.js';
import path from 'node:path';

describe('ShellToolService', () => {
  let service: ShellToolService;
  let config: ToolsConfig;

  beforeEach(() => {
    config = {
      workingDirRoot: process.cwd(),
      maxOutputBytes: 10000,
      executionTimeoutMs: 5000
    };
    service = new ShellToolService(config);
  });

  describe('executeTool', () => {
    it('should execute echo command', async () => {
      const result = await service.executeTool('echo', ['Hello World']);

      expect(result.status).toBe('success');
      expect(result.stdout?.trim()).toBe('Hello World');
      expect(result.exitCode).toBe(0);
    });

    it('should execute pwd command', async () => {
      const result = await service.executeTool('pwd', []);

      expect(result.status).toBe('success');
      expect(result.stdout?.trim()).toBeTruthy();
      expect(result.exitCode).toBe(0);
    });

    it('should execute which command', async () => {
      const result = await service.executeTool('which', ['node']);

      expect(result.status).toBe('success');
      expect(result.stdout?.trim()).toContain('node');
      expect(result.exitCode).toBe(0);
    });

    it('should execute ls command with current directory', async () => {
      const result = await service.executeTool('ls', []);

      expect(result.status).toBe('success');
      expect(result.stdout).toBeTruthy();
      expect(result.exitCode).toBe(0);
    });

    it('should handle command errors gracefully', async () => {
      // Use a nonexistent file within the working directory
      const result = await service.executeTool('cat', ['nonexistent-file-12345.txt']);

      expect(result.status).toBe('error');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });

    it('should prevent directory traversal outside workingDirRoot', async () => {
      await expect(
        service.executeTool('cat', ['../../../etc/passwd'])
      ).rejects.toThrow(ShellToolError);
    });

    it('should truncate output if it exceeds maxOutputBytes', async () => {
      const smallConfig: ToolsConfig = {
        ...config,
        maxOutputBytes: 100
      };
      const smallService = new ShellToolService(smallConfig);

      // Generate output larger than maxOutputBytes
      const result = await smallService.executeTool('echo', [
        'A'.repeat(200)
      ]);

      expect(result.truncated).toBe(true);
      expect(result.stdout?.length).toBeLessThanOrEqual(100);
    });

    it('should include duration in result', async () => {
      const result = await service.executeTool('echo', ['test']);

      expect(result.durationMs).toBeGreaterThan(0);
    });
  });

  describe('path validation', () => {
    it('should allow paths within workingDirRoot', async () => {
      const testFile = path.join(config.workingDirRoot, 'package.json');
      const result = await service.executeTool('cat', [testFile]);

      expect(result.status).toBe('success');
    });

    it('should reject absolute paths outside workingDirRoot', async () => {
      await expect(
        service.executeTool('cat', ['/etc/passwd'])
      ).rejects.toThrow(ShellToolError);
    });

    it('should handle relative path resolution correctly', async () => {
      const result = await service.executeTool('ls', ['./src']);

      expect(result.status).toBe('success');
      expect(result.stdout).toBeTruthy();
    });
  });

  describe('command argument mapping', () => {
    it('should handle grep with pattern', async () => {
      // Create a test that searches for "test" in package.json
      const testFile = path.join(config.workingDirRoot, 'package.json');
      const result = await service.executeTool('grep', ['-i', 'name', testFile]);

      expect(result.status).toBe('success');
      // grep will return success if pattern is found
    });

    it('should handle head command with line count', async () => {
      const testFile = path.join(config.workingDirRoot, 'package.json');
      const result = await service.executeTool('head', ['-n', '3', testFile]);

      expect(result.status).toBe('success');
      expect(result.stdout).toBeTruthy();
    });

    it('should handle wc command', async () => {
      const testFile = path.join(config.workingDirRoot, 'package.json');
      const result = await service.executeTool('wc', ['-l', testFile]);

      expect(result.status).toBe('success');
      expect(result.stdout).toBeTruthy();
    });
  });
});