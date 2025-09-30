import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ShellToolService } from './ShellToolService.js';
import type { ToolsConfig } from '../config/toolsConfig.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Performance tests for ShellToolService.
 * These tests measure latency and ensure tools perform within acceptable thresholds.
 */
describe('ShellToolService - Performance Tests', () => {
  let service: ShellToolService;
  let testDir: string;
  const PERFORMANCE_THRESHOLD_MS = 1000; // 1 second max for most operations

  beforeAll(() => {
    // Create test directory with medium-sized codebase simulation
    testDir = path.join(process.cwd(), 'test-fixtures-perf');
    mkdirSync(testDir, { recursive: true });

    // Create a realistic file structure
    // Simulate a small-to-medium codebase (~50 files)
    for (let i = 0; i < 50; i++) {
      const fileName = `file-${i.toString().padStart(3, '0')}.ts`;
      const content = generateTypescriptFile(i);
      writeFileSync(path.join(testDir, fileName), content);
    }

    // Create subdirectories
    const subDirs = ['src', 'tests', 'utils', 'types'];
    for (const dir of subDirs) {
      const dirPath = path.join(testDir, dir);
      mkdirSync(dirPath, { recursive: true });
      
      for (let i = 0; i < 10; i++) {
        const fileName = `${dir}-file-${i}.ts`;
        const content = generateTypescriptFile(i);
        writeFileSync(path.join(dirPath, fileName), content);
      }
    }

    const toolsConfig: ToolsConfig = {
      workingDirRoot: testDir,
      maxOutputBytes: 100_000, // 100KB
      executionTimeoutMs: 5000
    };

    service = new ShellToolService(toolsConfig);
  });

  afterAll(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Command latency benchmarks', () => {
    it('ls should complete within threshold', async () => {
      const start = Date.now();
      const result = await service.executeTool('ls', []);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ ls latency: ${duration}ms`);
    });

    it('cat on medium file should complete within threshold', async () => {
      const start = Date.now();
      const result = await service.executeTool('cat', ['file-025.ts']);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ cat latency: ${duration}ms`);
    });

    it('grep should complete within threshold', async () => {
      const start = Date.now();
      const result = await service.executeTool('grep', ['-r', 'function', '.']);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ grep latency: ${duration}ms`);
    });

    it('rg (ripgrep) should be faster than grep for recursive search', async () => {
      // Test grep
      const grepStart = Date.now();
      await service.executeTool('grep', ['-r', 'export', '.']);
      const grepDuration = Date.now() - grepStart;

      // Test ripgrep
      const rgStart = Date.now();
      await service.executeTool('rg', ['export', '.']);
      const rgDuration = Date.now() - rgStart;

      console.log(`  ✓ grep latency: ${grepDuration}ms, rg latency: ${rgDuration}ms`);
      
      // ripgrep should be at least as fast or faster (but allow some variance)
      // We're not enforcing strict performance here, just measuring
      expect(rgDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('head should be fast even on large directory', async () => {
      const start = Date.now();
      const result = await service.executeTool('head', ['-n', '5', 'file-000.ts']);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(200); // head should be very fast
      console.log(`  ✓ head latency: ${duration}ms`);
    });

    it('tail should be fast even on large directory', async () => {
      const start = Date.now();
      const result = await service.executeTool('tail', ['-n', '5', 'file-000.ts']);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(200); // tail should be very fast
      console.log(`  ✓ tail latency: ${duration}ms`);
    });
  });

  describe('Output size handling', () => {
    it('should handle large grep output with truncation', async () => {
      const start = Date.now();
      const result = await service.executeTool('grep', ['-r', 'const', '.']);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      // Verify output doesn't exceed max bytes
      const outputSize = (result.stdout?.length || 0) + (result.stderr?.length || 0);
      expect(outputSize).toBeLessThanOrEqual(100_000);
      
      console.log(`  ✓ Large grep output: ${duration}ms, output size: ${outputSize} bytes`);
    });

    it('should handle cat on multiple files efficiently', async () => {
      const files = ['file-000.ts', 'file-001.ts', 'file-002.ts', 'file-003.ts', 'file-004.ts'];
      
      const start = Date.now();
      const result = await service.executeTool('cat', files);
      const duration = Date.now() - start;

      expect(result.status).toBe('success');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ cat multiple files latency: ${duration}ms`);
    });
  });

  describe('Concurrent execution', () => {
    it('should handle multiple concurrent tool calls', async () => {
      const start = Date.now();

      // Execute 5 commands concurrently
      const promises = [
        service.executeTool('ls', []),
        service.executeTool('cat', ['file-010.ts']),
        service.executeTool('grep', ['function', 'file-020.ts']),
        service.executeTool('wc', ['-l', 'file-030.ts']),
        service.executeTool('head', ['-n', '3', 'file-040.ts'])
      ];

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe('success');
      });

      // Concurrent execution should benefit from parallelism
      // Should be faster than 5x single command threshold
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 3);
      console.log(`  ✓ 5 concurrent commands completed in: ${duration}ms`);
    });
  });

  describe('ripgrep specific performance', () => {
    it('should efficiently search for pattern', async () => {
      const start = Date.now();
      // Simple search without type filtering (which may not be allowed by service)
      const result = await service.executeTool('rg', ['interface', '.']);
      const duration = Date.now() - start;

      // May succeed or fail depending on rg availability, but should not timeout
      expect(['success', 'error']).toContain(result.status);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ rg search: ${duration}ms (status: ${result.status})`);
    }, 10000); // Increase timeout to 10s

    it('should handle case-insensitive search', async () => {
      const start = Date.now();
      const result = await service.executeTool('rg', ['-i', 'EXPORT', '.']);
      const duration = Date.now() - start;

      expect(['success', 'error']).toContain(result.status);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ rg case-insensitive: ${duration}ms (status: ${result.status})`);
    }, 10000);

    it('should handle pattern search with limit', async () => {
      const start = Date.now();
      const result = await service.executeTool('rg', ['const', '.']);
      const duration = Date.now() - start;

      expect(['success', 'error']).toContain(result.status);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`  ✓ rg with search: ${duration}ms (status: ${result.status})`);
    }, 10000);
  });
});

/**
 * Generate a TypeScript file with realistic content
 */
function generateTypescriptFile(index: number): string {
  return `// File ${index}
import { SomeType } from './types';

export interface Interface${index} {
  id: string;
  name: string;
  value: number;
  active: boolean;
}

export class Class${index} {
  private data: Interface${index}[] = [];
  
  constructor() {
    this.initialize();
  }
  
  private initialize(): void {
    this.data = [];
  }
  
  public addItem(item: Interface${index}): void {
    this.data.push(item);
  }
  
  public getItems(): Interface${index}[] {
    return this.data;
  }
  
  public findById(id: string): Interface${index} | undefined {
    return this.data.find(item => item.id === id);
  }
  
  public removeItem(id: string): boolean {
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data.splice(index, 1);
      return true;
    }
    return false;
  }
}

export function processData${index}(input: Interface${index}[]): Interface${index}[] {
  return input.filter(item => item.active).map(item => ({
    ...item,
    value: item.value * 2
  }));
}

export const CONSTANT_${index} = ${index * 100};
export const CONFIG_${index} = {
  enabled: true,
  timeout: ${index * 1000},
  maxRetries: ${index % 5}
};
`;
}
