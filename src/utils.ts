/**
 * Shared utility functions and constants
 */

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 500;
export const RETRY_BACKOFF_MULTIPLIER = 2;
export const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Request timeout (30 seconds)
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * Sleep for the specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse an integer from an environment variable with validation
 */
export function parseIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${name} value. Expected an integer between ${min} and ${max}.`
    );
  }

  return parsed;
}

/**
 * Get a required environment variable, throwing if it's not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get an optional environment variable, returning undefined if not set
 */
export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Validate and get a URL from environment variable
 */
export function getRequiredUrl(name: string): string {
  const value = getRequiredEnv(name);

  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(
      `Invalid ${name} value. Expected a valid URL, got: ${value.slice(0, 50)}`
    );
  }
}
