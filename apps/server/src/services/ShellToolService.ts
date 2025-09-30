import { spawn } from 'node:child_process';
import path from 'node:path';
import type { ToolsConfig } from '../config/toolsConfig.js';
import type {
  ApprovedShellCommand,
  ShellToolExecutionResult
} from '../types/tools.js';

export interface ShellToolLogger {
  info: (msg: string, metadata?: Record<string, unknown>) => void;
  warn: (msg: string, metadata?: Record<string, unknown>) => void;
  error: (msg: string, metadata?: Record<string, unknown>) => void;
}

export class ShellToolError extends Error {
  constructor(message: string, public readonly command: string) {
    super(message);
    this.name = 'ShellToolError';
  }
}

export class ShellToolService {
  private readonly config: ToolsConfig;
  private readonly logger?: ShellToolLogger;

  constructor(config: ToolsConfig, logger?: ShellToolLogger) {
    this.config = config;
    this.logger = logger;
  }

  async executeTool(
    command: ApprovedShellCommand,
    args: string[]
  ): Promise<ShellToolExecutionResult> {
    const startTime = Date.now();

    this.logger?.info('Executing shell tool', { command, args });

    // Validate and normalize paths in arguments
    const normalizedArgs = this.validateAndNormalizePaths(command, args);

    try {
      const result = await this.spawnProcess(command, normalizedArgs);
      const durationMs = Date.now() - startTime;

      this.logger?.info('Shell tool execution completed', {
        command,
        durationMs,
        status: result.status
      });

      return {
        ...result,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger?.error('Shell tool execution failed', {
        command,
        durationMs,
        error: errorMessage
      });

      throw new ShellToolError(
        `Failed to execute ${command}: ${errorMessage}`,
        command
      );
    }
  }

  private validateAndNormalizePaths(
    command: ApprovedShellCommand,
    args: string[]
  ): string[] {
    // Commands that work with file paths
    const pathCommands: ApprovedShellCommand[] = [
      'cat',
      'ls',
      'grep',
      'rg',
      'head',
      'tail',
      'wc'
    ];

    if (!pathCommands.includes(command)) {
      return args;
    }

    return args.map((arg) => {
      // Skip flags (arguments starting with -)
      if (arg.startsWith('-')) {
        return arg;
      }

      // For grep/rg, the first non-flag argument is the pattern, not a path
      const isPattern =
        (command === 'grep' || command === 'rg') &&
        args.indexOf(arg) === args.findIndex((a) => !a.startsWith('-'));

      if (isPattern) {
        return arg;
      }

      // Check if argument looks like a file path
      if (this.looksLikePath(arg)) {
        return this.validatePath(arg);
      }

      return arg;
    });
  }

  private looksLikePath(arg: string): boolean {
    // Check if argument contains path-like characters
    return (
      arg.includes('/') ||
      arg.includes('.') ||
      arg === '.' ||
      arg === '..'
    );
  }

  private validatePath(inputPath: string): string {
    // Resolve to absolute path
    const absolutePath = path.resolve(this.config.workingDirRoot, inputPath);

    // Ensure path is within the allowed root directory
    if (!absolutePath.startsWith(this.config.workingDirRoot)) {
      throw new ShellToolError(
        `Path '${inputPath}' is outside the allowed working directory`,
        'path-validation'
      );
    }

    return absolutePath;
  }

  private async spawnProcess(
    command: ApprovedShellCommand,
    args: string[]
  ): Promise<ShellToolExecutionResult> {
    return new Promise((resolve) => {
      const process = spawn(command, args, {
        cwd: this.config.workingDirRoot,
        timeout: this.config.executionTimeoutMs
      });

      let stdout = '';
      let stderr = '';
      let truncated = false;

      process.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length > this.config.maxOutputBytes) {
          stdout += chunk.substring(
            0,
            this.config.maxOutputBytes - stdout.length
          );
          truncated = true;
          process.kill();
        } else {
          stdout += chunk;
        }
      });

      process.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stderr.length + chunk.length > this.config.maxOutputBytes) {
          stderr += chunk.substring(
            0,
            this.config.maxOutputBytes - stderr.length
          );
          truncated = true;
          process.kill();
        } else {
          stderr += chunk;
        }
      });

      process.on('close', (exitCode) => {
        const result: ShellToolExecutionResult = {
          status: exitCode === 0 ? 'success' : 'error',
          exitCode: exitCode ?? undefined,
          truncated
        };

        if (stdout) {
          result.stdout = stdout;
        }

        if (stderr) {
          result.stderr = stderr;
        }

        if (exitCode !== 0 && !stderr) {
          result.errorMessage = `Command exited with code ${exitCode}`;
        }

        resolve(result);
      });

      process.on('error', (error) => {
        resolve({
          status: 'error',
          errorMessage: error.message,
          truncated
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          resolve({
            status: 'timeout',
            errorMessage: `Command timed out after ${this.config.executionTimeoutMs}ms`,
            stdout: stdout || undefined,
            stderr: stderr || undefined,
            truncated
          });
        }
      }, this.config.executionTimeoutMs);
    });
  }
}