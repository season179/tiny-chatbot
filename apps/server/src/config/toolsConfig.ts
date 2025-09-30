import type { ShellToolDefinition } from '../types/tools.js';

export interface ToolsConfig {
  workingDirRoot: string;
  maxOutputBytes: number;
  executionTimeoutMs: number;
}

export const DEFAULT_TOOLS_CONFIG: ToolsConfig = {
  workingDirRoot: process.cwd(),
  maxOutputBytes: 100_000, // 100KB
  executionTimeoutMs: 30_000 // 30 seconds
};

/**
 * Tool definitions compatible with OpenAI Responses API format
 */
export const SHELL_TOOL_DEFINITIONS: ShellToolDefinition[] = [
  {
    name: 'cat',
    description: 'Display the contents of one or more files',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to display'
        }
      },
      required: ['paths']
    }
  },
  {
    name: 'ls',
    description: 'List directory contents',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (defaults to current directory)'
        },
        showHidden: {
          type: 'boolean',
          description: 'Include hidden files (starting with .)'
        }
      }
    }
  },
  {
    name: 'grep',
    description: 'Search for patterns in files using grep',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern to search for'
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to search in'
        },
        ignoreCase: {
          type: 'boolean',
          description: 'Perform case-insensitive search'
        }
      },
      required: ['pattern', 'paths']
    }
  },
  {
    name: 'rg',
    description: 'Search for patterns in files using ripgrep (faster alternative to grep)',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern to search for'
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files or directories to search in'
        },
        ignoreCase: {
          type: 'boolean',
          description: 'Perform case-insensitive search'
        }
      },
      required: ['pattern', 'paths']
    }
  },
  {
    name: 'head',
    description: 'Display the first lines of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read'
        },
        lines: {
          type: 'number',
          description: 'Number of lines to display (default: 10)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'tail',
    description: 'Display the last lines of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read'
        },
        lines: {
          type: 'number',
          description: 'Number of lines to display (default: 10)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'pwd',
    description: 'Print the current working directory',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'echo',
    description: 'Display a line of text or variable value',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to display'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'wc',
    description: 'Count lines, words, and bytes in files',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to analyze'
        },
        countLines: {
          type: 'boolean',
          description: 'Count lines'
        },
        countWords: {
          type: 'boolean',
          description: 'Count words'
        },
        countBytes: {
          type: 'boolean',
          description: 'Count bytes'
        }
      },
      required: ['paths']
    }
  },
  {
    name: 'which',
    description: 'Locate a command and show its path',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command name to locate'
        }
      },
      required: ['command']
    }
  }
];