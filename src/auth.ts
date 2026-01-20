import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = ".cache";
const NCFA_CACHE_FILE = "ncfa_token.txt";
const SIGN_IN_URL = "https://www.geoguessr.com/api/v3/accounts/signin";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type SignInResponse = {
  token: string;
  rawSetCookie: string | null;
  responseBody: string;
};

function extractNcfaToken(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const match = setCookieHeader.match(/_ncfa=([^;]+)/);
  return match ? match[1] : null;
}

async function readCachedNcfaToken(): Promise<string | null> {
  try {
    const content = await readFile(join(CACHE_DIR, NCFA_CACHE_FILE), "utf8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

async function writeCachedNcfaToken(token: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, NCFA_CACHE_FILE), `${token}\n`, "utf8");
}

async function signIn(): Promise<SignInResponse> {
  const email = process.env.GEOGUESSR_EMAIL?.trim();
  const password = process.env.GEOGUESSR_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error(
      "Missing GEOGUESSR_EMAIL or GEOGUESSR_PASSWORD environment variables for sign-in."
    );
  }

  const response = await fetch(SIGN_IN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": DEFAULT_USER_AGENT
    },
    body: JSON.stringify({ email, password })
  });

  const responseBody = await response.text();
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieValues = headers.getSetCookie
    ? headers.getSetCookie().join(", ")
    : response.headers.get("set-cookie");

  console.log("Sign-in response status:", response.status);
  console.log("Sign-in set-cookie:", setCookieValues ?? "(none)");
  console.log("Sign-in response body:", responseBody.slice(0, 1000));

  if (!response.ok) {
    throw new Error(
      `GeoGuessr sign-in failed (${response.status}): ${responseBody.slice(0, 200)}`
    );
  }

  const token = extractNcfaToken(setCookieValues ?? null);
  if (!token) {
    throw new Error(
      "GeoGuessr sign-in succeeded but did not return an _ncfa token."
    );
  }

  return {
    token,
    rawSetCookie: setCookieValues ?? null,
    responseBody
  };
}

export async function resolveNcfaToken(): Promise<string> {
  const envToken = process.env.NCFA_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  const cachedToken = await readCachedNcfaToken();
  if (cachedToken) {
    return cachedToken;
  }

  const signInResult = await signIn();
  await writeCachedNcfaToken(signInResult.token);
  return signInResult.token;
}

export async function refreshNcfaToken(): Promise<string> {
  const signInResult = await signIn();
  await writeCachedNcfaToken(signInResult.token);
  return signInResult.token;
}
