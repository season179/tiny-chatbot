import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('POST /api/session', () => {
  it('should create a new session with valid input', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {
        tenantId: 'tenant-123',
        userId: 'user-456',
        traits: { locale: 'en-US' }
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.tenantId).toBe('tenant-123');
    expect(body.userId).toBe('user-456');
    expect(body.createdAt).toBeTruthy();

    await app.close();
  });

  it('should create session without optional userId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {
        tenantId: 'tenant-123'
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.userId).toBeUndefined();

    await app.close();
  });

  it('should return 400 for missing tenantId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.details).toBeDefined();

    await app.close();
  });

  it('should return 400 for empty tenantId', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {
        tenantId: ''
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('should accept and return traits', async () => {
    const app = await buildServer();

    const traits = { role: 'admin', customField: 'value' };
    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {
        tenantId: 'tenant-123',
        traits
      }
    });

    expect(response.statusCode).toBe(201);

    await app.close();
  });
});