import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('GET /healthz', () => {
  it('should return ok status', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/healthz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});