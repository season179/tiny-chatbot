export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes?: number[];
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

const DEFAULT_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Retries an async operation with exponential backoff.
 * @param operation The async function to retry
 * @param options Retry configuration
 * @returns The result of the successful operation
 * @throws RetryError if all retry attempts are exhausted
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableStatusCodes = DEFAULT_RETRYABLE_STATUS_CODES
  } = options;

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;

      // Don't retry if we've exhausted attempts
      if (attempt > maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, retryableStatusCodes)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const jitter = Math.random() * 0.1 * baseDelay; // Add 0-10% jitter
      const delay = Math.min(baseDelay + jitter, maxDelayMs);

      await sleep(delay);
    }
  }

  throw new RetryError(
    `Operation failed after ${attempt} attempts`,
    attempt,
    lastError
  );
}

function isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
  // Handle OpenAI SDK errors
  if (error && typeof error === 'object') {
    // Check for status code property (common in HTTP errors)
    if ('status' in error && typeof error.status === 'number') {
      return retryableStatusCodes.includes(error.status);
    }

    // Check for statusCode property (alternative naming)
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return retryableStatusCodes.includes(error.statusCode);
    }

    // Check for error.error.status (nested error structure)
    if ('error' in error && error.error && typeof error.error === 'object') {
      if ('status' in error.error && typeof error.error.status === 'number') {
        return retryableStatusCodes.includes(error.error.status);
      }
    }
  }

  // By default, retry on network errors (but not on validation errors, etc.)
  // Network errors typically have these properties
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    // Common network error codes
    return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(code);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}