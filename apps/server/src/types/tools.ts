export type ApprovedShellCommand =
  | 'cat'
  | 'echo'
  | 'grep'
  | 'rg'
  | 'head'
  | 'tail'
  | 'ls'
  | 'pwd'
  | 'wc'
  | 'which';

export interface ShellToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ShellToolExecutionInput {
  command: ApprovedShellCommand;
  args: string[];
}

export interface ShellToolExecutionResult {
  status: 'success' | 'error' | 'timeout';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  truncated?: boolean;
  errorMessage?: string;
}