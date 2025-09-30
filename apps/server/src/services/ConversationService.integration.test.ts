import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationService } from './ConversationService.js';
import { InMemorySessionStore } from '../repositories/InMemorySessionStore.js';
import { ShellToolService } from './ShellToolService.js';
import type { SessionStore } from '../repositories/SessionStore.js';
import type { OpenAIService, GenerateResponseResult, ToolCall } from './OpenAIService.js';
import type { ToolsConfig } from '../config/toolsConfig.js';
import { SHELL_TOOL_DEFINITIONS } from '../config/toolsConfig.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Integration tests for the agentic conversation loop.
 * These tests use real ShellToolService but mock OpenAI responses to simulate tool calls.
 */
describe('ConversationService - Integration Tests', () => {
  let sessionStore: SessionStore;
  let conversationService: ConversationService;
  let mockOpenAIService: OpenAIService;
  let shellToolService: ShellToolService;
  let testDir: string;

  beforeEach(() => {
    // Create test directory with test files
    testDir = path.join(process.cwd(), 'test-fixtures-integration');
    mkdirSync(testDir, { recursive: true });
    
    writeFileSync(path.join(testDir, 'test-file.txt'), 'Hello from test file!\nLine 2\nLine 3');
    writeFileSync(path.join(testDir, 'another-file.txt'), 'Another test content');
    
    sessionStore = new InMemorySessionStore();
    
    // Configure ShellToolService with test directory
    const toolsConfig: ToolsConfig = {
      workingDirRoot: testDir,
      maxOutputBytes: 10000,
      executionTimeoutMs: 5000
    };
    
    shellToolService = new ShellToolService(toolsConfig);
    
    // Mock OpenAI service - we'll customize responses per test
    mockOpenAIService = {
      generateResponse: vi.fn(),
      generateStreamingResponse: vi.fn()
    } as unknown as OpenAIService;
    
    conversationService = new ConversationService(
      sessionStore,
      mockOpenAIService,
      undefined, // no prompt service
      shellToolService,
      SHELL_TOOL_DEFINITIONS
    );
  });

  afterEach(() => {
    // Clean up test directory
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Single tool call flow', () => {
    it('should execute cat command and include result in final response', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      // First call: AI decides to use cat tool
      const toolCall: ToolCall = {
        id: 'call_123',
        name: 'cat',
        arguments: { paths: ['test-file.txt'] }
      };

      // Second call: AI provides final answer using tool result
      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        .mockResolvedValueOnce({
          content: 'The file contains: "Hello from test file!"',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'What is in test-file.txt?'
      });

      // Verify final response
      expect(result.assistantMessage.content).toBe('The file contains: "Hello from test file!"');
      
      // Verify session contains all messages: user, assistant (function call), tool, assistant (final)
      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(4);
      
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[0].content).toBe('What is in test-file.txt?');
      
      expect(updatedSession?.messages[1].role).toBe('assistant');
      expect(updatedSession?.messages[1].content).toBe('__FUNCTION_CALLS__');
      
      expect(updatedSession?.messages[2].role).toBe('tool');
      if (updatedSession?.messages[2].role === 'tool') {
        expect(updatedSession.messages[2].toolName).toBe('cat');
        expect(updatedSession.messages[2].result?.status).toBe('success');
        expect(updatedSession.messages[2].result?.stdout).toContain('Hello from test file!');
      }
      
      expect(updatedSession?.messages[3].role).toBe('assistant');
      expect(updatedSession?.messages[3].content).toBe('The file contains: "Hello from test file!"');

      // Verify OpenAI was called twice
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledTimes(2);
    });

    it('should handle ls command to list directory contents', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const toolCall: ToolCall = {
        id: 'call_456',
        name: 'ls',
        arguments: { path: '.' }
      };

      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        .mockResolvedValueOnce({
          content: 'I found test-file.txt and another-file.txt',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'What files are in the directory?'
      });

      expect(result.assistantMessage.content).toBe('I found test-file.txt and another-file.txt');
      
      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(4);
      
      const toolMessage = updatedSession?.messages[2];
      if (toolMessage?.role === 'tool') {
        expect(toolMessage.toolName).toBe('ls');
        expect(toolMessage.result?.status).toBe('success');
        expect(toolMessage.result?.stdout).toContain('test-file.txt');
        expect(toolMessage.result?.stdout).toContain('another-file.txt');
      }
    });

    it('should handle grep command to search file contents', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const toolCall: ToolCall = {
        id: 'call_789',
        name: 'grep',
        arguments: { 
          pattern: 'Hello',
          paths: ['test-file.txt']
        }
      };

      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        .mockResolvedValueOnce({
          content: 'Found "Hello" in the file',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Search for "Hello" in test-file.txt'
      });

      expect(result.assistantMessage.content).toBe('Found "Hello" in the file');
      
      const updatedSession = sessionStore.getSession(session.id);
      const toolMessage = updatedSession?.messages[2];
      
      if (toolMessage?.role === 'tool') {
        expect(toolMessage.toolName).toBe('grep');
        expect(toolMessage.result?.status).toBe('success');
        expect(toolMessage.result?.stdout).toContain('Hello');
      }
    });
  });

  describe('Multiple tool call rounds', () => {
    it('should handle multiple sequential tool calls', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      // Round 1: AI lists directory
      const toolCall1: ToolCall = {
        id: 'call_001',
        name: 'ls',
        arguments: { path: '.' }
      };

      // Round 2: AI reads a file
      const toolCall2: ToolCall = {
        id: 'call_002',
        name: 'cat',
        arguments: { paths: ['test-file.txt'] }
      };

      vi.mocked(mockOpenAIService.generateResponse)
        // First call: AI decides to list directory
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall1],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        // Second call: AI decides to read a file based on ls result
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall2],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        // Third call: AI provides final answer
        .mockResolvedValueOnce({
          content: 'I found test-file.txt containing "Hello from test file!"',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'List files and show me the content of test-file.txt'
      });

      expect(result.assistantMessage.content).toBe('I found test-file.txt containing "Hello from test file!"');
      
      // Verify session contains all messages:
      // user, assistant (fn call 1), tool 1, assistant (fn call 2), tool 2, assistant (final) = 6 messages
      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(6);
      
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[1].role).toBe('assistant'); // Function call 1
      expect(updatedSession?.messages[2].role).toBe('tool'); // ls result
      expect(updatedSession?.messages[3].role).toBe('assistant'); // Function call 2
      expect(updatedSession?.messages[4].role).toBe('tool'); // cat result
      expect(updatedSession?.messages[5].role).toBe('assistant'); // Final answer

      // Verify first tool was ls
      if (updatedSession?.messages[2].role === 'tool') {
        expect(updatedSession.messages[2].toolName).toBe('ls');
      }

      // Verify second tool was cat
      if (updatedSession?.messages[4].role === 'tool') {
        expect(updatedSession.messages[4].toolName).toBe('cat');
      }

      // Verify OpenAI was called 3 times
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple parallel tool calls in one round', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      // AI decides to read both files at once
      const toolCalls: ToolCall[] = [
        {
          id: 'call_parallel_1',
          name: 'cat',
          arguments: { paths: ['test-file.txt'] }
        },
        {
          id: 'call_parallel_2',
          name: 'cat',
          arguments: { paths: ['another-file.txt'] }
        }
      ];

      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls,
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        .mockResolvedValueOnce({
          content: 'First file says "Hello from test file!" and second says "Another test content"',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Read both test files'
      });

      expect(result.assistantMessage.content).toContain('Hello from test file!');
      expect(result.assistantMessage.content).toContain('Another test content');
      
      const updatedSession = sessionStore.getSession(session.id);
      // user, assistant (fn calls), tool 1, tool 2, assistant (final)
      expect(updatedSession?.messages).toHaveLength(5);
      
      // Verify both tool results are present
      const toolMessages = updatedSession?.messages.filter(m => m.role === 'tool');
      expect(toolMessages).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      // AI tries to read a non-existent file
      const toolCall: ToolCall = {
        id: 'call_error',
        name: 'cat',
        arguments: { paths: ['non-existent-file.txt'] }
      };

      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValueOnce({
          content: undefined,
          toolCalls: [toolCall],
          finishReason: 'tool_calls'
        } as GenerateResponseResult)
        .mockResolvedValueOnce({
          content: 'I could not find that file',
          finishReason: 'stop'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Read non-existent-file.txt'
      });

      expect(result.assistantMessage.content).toBe('I could not find that file');
      
      // Verify tool message contains error
      const updatedSession = sessionStore.getSession(session.id);
      const toolMessage = updatedSession?.messages[2];
      
      if (toolMessage?.role === 'tool') {
        expect(toolMessage.result?.status).toBe('error');
        expect(toolMessage.result?.exitCode).not.toBe(0);
      }
    });

    it('should stop after max tool rounds and return error message', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      // Mock AI to always return tool calls (never stop)
      vi.mocked(mockOpenAIService.generateResponse)
        .mockResolvedValue({
          content: undefined,
          toolCalls: [{
            id: 'call_infinite',
            name: 'ls',
            arguments: { path: '.' }
          }],
          finishReason: 'tool_calls'
        } as GenerateResponseResult);

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'This will trigger infinite loop'
      });

      // Should get error message about exceeding max rounds
      expect(result.assistantMessage.content).toContain('maximum number of tool execution rounds');
      
      // Verify it stopped at max rounds (default is 10)
      // Each round creates: assistant (fn call) + tool message
      // Plus initial user message and final error message
      const updatedSession = sessionStore.getSession(session.id);
      // user + (assistant + tool) * 10 rounds + final assistant error = 22 messages
      expect(updatedSession?.messages.length).toBe(22);
    });
  });
});

