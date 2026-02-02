import {
  DEFAULT_USER_AGENT,
  sleep,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_BACKOFF_MULTIPLIER,
  RETRYABLE_STATUS_CODES,
  REQUEST_TIMEOUT_MS,
} from "./utils.js";

async function postWithRetry(
  url: string,
  payload: unknown,
  attempt = 1
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return response;
    }

    if (
      RETRYABLE_STATUS_CODES.includes(response.status) &&
      attempt < MAX_RETRY_ATTEMPTS
    ) {
      const delay =
        RETRY_BASE_DELAY_MS * RETRY_BACKOFF_MULTIPLIER ** (attempt - 1);
      console.warn(
        `Discord webhook failed with ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`
      );
      await sleep(delay);
      return postWithRetry(url, payload, attempt + 1);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  }
}

export async function postDiscordMessage(
  webhookUrl: string,
  content: string
): Promise<void> {
  const response = await postWithRetry(webhookUrl, { content });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Discord webhook failed (${response.status}): ${body.slice(0, 200)}`
    );
  }
}
