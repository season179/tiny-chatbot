import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('POST /api/feedback', () => {
  it('should accept valid feedback with up score', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'up'
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('RECEIVED');

    await app.close();
  });

  it('should accept valid feedback with down score', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'down'
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('RECEIVED');

    await app.close();
  });

  it('should accept feedback with optional comments', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'up',
        comments: 'Very helpful response!'
      }
    });

    expect(response.statusCode).toBe(202);

    await app.close();
  });

  it('should return 400 for missing sessionId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        messageId: 'msg-456',
        score: 'up'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for missing messageId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        score: 'up'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for missing score', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for invalid score value', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'invalid'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should return 400 for comments exceeding max length', async () => {
    const app = await buildServer();

    const longComment = 'a'.repeat(1001); // Exceeds 1000 char limit

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'up',
        comments: longComment
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should accept comments at max length', async () => {
    const app = await buildServer();

    const maxComment = 'a'.repeat(1000);

    const response = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        sessionId: 'session-123',
        messageId: 'msg-456',
        score: 'down',
        comments: maxComment
      }
    });

    expect(response.statusCode).toBe(202);

    await app.close();
  });
});