import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
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
  private normalizedWorkingDir: string;

  constructor(config: ToolsConfig, logger?: ShellToolLogger) {
    this.config = config;
    this.logger = logger;
    
    // Normalize path (will be validated later if sandbox is enabled)
    this.normalizedWorkingDir = path.isAbsolute(config.workingDirRoot)
      ? path.resolve(config.workingDirRoot) + path.sep
      : config.workingDirRoot; // Keep as-is for error message
    
    this.logger?.info(`📁 ShellToolService sandbox: ${this.normalizedWorkingDir}`, {
      originalWorkingDir: config.workingDirRoot,
      resolvedWorkingDir: this.normalizedWorkingDir,
      maxOutputBytes: config.maxOutputBytes,
      executionTimeoutMs: config.executionTimeoutMs
    });
  }

  /**
   * Validates that the working directory is absolute and exists.
   * Should be called at server startup if shell tools are enabled.
   * @throws {ShellToolError} if path is not absolute or directory doesn't exist
   */
  validateWorkingDirectory(): void {
    // First, validate that the path is absolute
    if (!path.isAbsolute(this.config.workingDirRoot)) {
      const error = `SHELL_SANDBOX_WORKING_DIR must be an absolute path.\n` +
        `Got: ${this.config.workingDirRoot}\n` +
        `\nPlease update your .env file to use an absolute path.\n` +
        `Example: SHELL_SANDBOX_WORKING_DIR=/Users/season/Personal/wrapper-for-chatbot/tiny-chatbot/proprietary-documents`;
      this.logger?.error(`❌ ${error}`);
      throw new ShellToolError(error, 'config-validation');
    }
    
    // Re-normalize now that we know it's absolute
    this.normalizedWorkingDir = path.resolve(this.config.workingDirRoot) + path.sep;
    
    // Then validate that the directory exists
    if (!existsSync(this.normalizedWorkingDir.slice(0, -1))) {
      const error = `Shell sandbox directory does not exist: ${this.normalizedWorkingDir}\n` +
        `\nPlease create the directory or update SHELL_SANDBOX_WORKING_DIR in your .env file.`;
      this.logger?.error(`❌ ${error}`);
      throw new ShellToolError(error, 'directory-validation');
    }
    
    this.logger?.info(`✅ Shell sandbox directory validated: ${this.normalizedWorkingDir}`);
  }

  async executeTool(
    command: ApprovedShellCommand,
    args: string[]
  ): Promise<ShellToolExecutionResult> {
    const startTime = Date.now();

    this.logger?.info(`🔧 Executing tool: ${command} ${args.join(' ')}`, { 
      command, 
      args,
      workingDir: this.normalizedWorkingDir
    });

    // Validate and normalize paths in arguments
    const normalizedArgs = this.validateAndNormalizePaths(command, args);

    try {
      const result = await this.spawnProcess(command, normalizedArgs);
      const durationMs = Date.now() - startTime;

      const statusEmoji = result.status === 'success' ? '✅' : '❌';
      this.logger?.info(
        `${statusEmoji} Tool ${command} completed: ${result.status} (${durationMs}ms, stdout: ${result.stdout?.length || 0} bytes, stderr: ${result.stderr?.length || 0} bytes)`,
        {
          command,
          args: normalizedArgs,
          durationMs,
          status: result.status,
          exitCode: result.exitCode,
          stdoutLength: result.stdout?.length || 0,
          stderrLength: result.stderr?.length || 0,
          truncated: result.truncated,
          // Include first 500 chars of output for debugging
          stdoutPreview: result.stdout?.substring(0, 500),
          stderrPreview: result.stderr?.substring(0, 500)
        }
      );

      return {
        ...result,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger?.error(`❌ Tool ${command} failed: ${errorMessage}`, {
        command,
        args,
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
    // Use normalized path with trailing separator to prevent bypass attacks
    // (e.g., /sandbox-evil would incorrectly pass a startsWith check for /sandbox)
    const normalizedAbsolutePath = path.resolve(absolutePath) + path.sep;
    if (!normalizedAbsolutePath.startsWith(this.normalizedWorkingDir)) {
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
      // Use the resolved absolute path without trailing separator for cwd
      const cwd = this.normalizedWorkingDir.slice(0, -1);
      const process = spawn(command, args, {
        cwd,
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