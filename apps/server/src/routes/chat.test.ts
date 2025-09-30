import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('POST /api/chat', () => {
  it('should return assistant message for valid request', async () => {
    const app = await buildServer();

    // Create a session first
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { tenantId: 'tenant-1' }
    });
    const { sessionId } = sessionResponse.json();

    // Send chat message
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId,
        message: 'Hello, world!'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sessionId).toBe(sessionId);
    expect(body.message).toBeDefined();
    expect(body.message.role).toBe('assistant');
    expect(body.message.content).toContain('Hello, world!');
    expect(body.message.id).toBeTruthy();
    expect(body.message.createdAt).toBeTruthy();

    await app.close();
  });

  it('should return 400 for missing sessionId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Hello'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.details).toBeDefined();

    await app.close();
  });

  it('should return 400 for missing message', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId: 'some-id'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for empty message', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId: 'some-id',
        message: ''
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 404 for non-existent session', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId: 'non-existent-session',
        message: 'Hello'
      }
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe('SESSION_NOT_FOUND');

    await app.close();
  });

  it('should accept optional metadata', async () => {
    const app = await buildServer();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { tenantId: 'tenant-1' }
    });
    const { sessionId } = sessionResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId,
        message: 'Hello',
        metadata: { source: 'widget', version: '1.0' }
      }
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it('should maintain conversation history', async () => {
    const app = await buildServer();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { tenantId: 'tenant-1' }
    });
    const { sessionId } = sessionResponse.json();

    // First message
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { sessionId, message: 'First message' }
    });
    expect(response1.json().message.content).toContain('#1');

    // Second message
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { sessionId, message: 'Second message' }
    });
    expect(response2.json().message.content).toContain('#2');

    await app.close();
  });
});