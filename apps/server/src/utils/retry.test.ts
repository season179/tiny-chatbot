import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, RetryError } from './retry.js';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return result on first successful attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors (429)', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should retry on 500 errors', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry on 502 errors', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 502 }).mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry on 503 errors', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry on 504 errors', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 504 }).mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry on network errors (ECONNRESET)', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors (400)', async () => {
    const operation = vi.fn().mockRejectedValue({ status: 400 });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      })
    ).rejects.toEqual({ status: 400 });

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should not retry on non-retryable errors (401)', async () => {
    const operation = vi.fn().mockRejectedValue({ status: 401 });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      })
    ).rejects.toEqual({ status: 401 });

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw RetryError after exhausting all retries', async () => {
    const operation = vi.fn().mockRejectedValue({ status: 429 });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      })
    ).rejects.toThrow(RetryError);

    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should include attempt count and last error in RetryError', async () => {
    const lastError = { status: 429, message: 'Rate limited' };
    const operation = vi.fn().mockRejectedValue(lastError);

    try {
      await retryWithBackoff(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      });
      expect.fail('Should have thrown RetryError');
    } catch (error) {
      expect(error).toBeInstanceOf(RetryError);
      if (error instanceof RetryError) {
        expect(error.attempts).toBe(3);
        expect(error.lastError).toEqual(lastError);
      }
    }
  });

  it('should handle statusCode property (alternative naming)', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 429 })
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should handle nested error structure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ error: { status: 429 } })
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should respect custom retryable status codes', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 418 }).mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      retryableStatusCodes: [418] // I'm a teapot
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});