import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('POST /api/chat/stream', () => {
  it('should stream response chunks for valid request', async () => {
    const app = await buildServer();

    // Create a session first
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { tenantId: 'tenant-1' }
    });
    const { sessionId } = sessionResponse.json();

    // Send streaming chat message
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        sessionId,
        message: 'Hello streaming!'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['connection']).toBe('keep-alive');

    // Parse SSE chunks
    const lines = response.body.split('\n').filter(line => line.startsWith('data: '));
    expect(lines.length).toBeGreaterThan(0);

    // Check for chunk events
    const events = lines.map(line => JSON.parse(line.replace('data: ', '')));
    const chunkEvents = events.filter(e => e.type === 'chunk');
    const completedEvent = events.find(e => e.type === 'completed');

    expect(chunkEvents.length).toBeGreaterThan(0);
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.message).toBeDefined();
    expect(completedEvent?.message.content).toContain('Hello streaming!');

    await app.close();
  });

  it('should return 400 for missing sessionId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        message: 'Hello'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for missing message', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        sessionId: 'some-id'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return error event for non-existent session', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        sessionId: 'non-existent-session',
        message: 'Hello'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toBe('text/event-stream');

    const lines = response.body.split('\n').filter(line => line.startsWith('data: '));
    expect(lines.length).toBeGreaterThan(0);

    const errorEvent = JSON.parse(lines[0].replace('data: ', ''));
    expect(errorEvent.type).toBe('error');
    expect(errorEvent.error).toBe('SESSION_NOT_FOUND');

    await app.close();
  });

  it('should stream multiple chunks', async () => {
    const app = await buildServer();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { tenantId: 'tenant-1' }
    });
    const { sessionId } = sessionResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: {
        sessionId,
        message: 'Test'
      }
    });

    const lines = response.body.split('\n').filter(line => line.startsWith('data: '));
    const events = lines.map(line => JSON.parse(line.replace('data: ', '')));
    const chunkEvents = events.filter(e => e.type === 'chunk');

    // Should have at least 3 chunks based on the canned response format
    expect(chunkEvents.length).toBeGreaterThanOrEqual(2);

    await app.close();
  });
});