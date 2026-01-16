const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(
  url: string,
  payload: unknown,
  attempt = 1
): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": DEFAULT_USER_AGENT
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    return response;
  }

  if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
    const delay = 500 * 2 ** (attempt - 1);
    console.warn(
      `Discord webhook failed with ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/3).`
    );
    await sleep(delay);
    return postWithRetry(url, payload, attempt + 1);
  }

  return response;
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
