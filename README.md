# GeoGuessr Daily Friends → Discord

Fetch today’s GeoGuessr Daily Challenge friends leaderboard and post it to a Discord channel via a webhook.

## Features

- GeoGuessr Daily Challenge “friends” leaderboard for the logged-in account.
- Discord webhook post with a clean, table-like message.
- Retries with exponential backoff for transient errors (429/5xx).
- Optional idempotency via a cached daily token.
- Scheduled daily via GitHub Actions.

## Prerequisites

- Node.js 20+
- A GeoGuessr session cookie or GeoGuessr credentials
- A Discord webhook URL

## Setup

### 1) Set up GeoGuessr authentication

You can authenticate with either an existing `_ncfa` cookie token or by
providing your GeoGuessr credentials so the app can sign in and cache a token.

**Option A: Use an existing `_ncfa` token**

1. Log into GeoGuessr in your browser.
2. Open DevTools → **Application** (Chrome) or **Storage** (Firefox).
3. Under **Cookies**, select `https://www.geoguessr.com`.
4. Copy the `_ncfa` cookie value.
5. Store it in an environment variable named `NCFA_TOKEN`.

**Option B: Use credentials to sign in**

1. Set `GEOGUESSR_EMAIL` and `GEOGUESSR_PASSWORD`.
2. On first run, the app signs in, logs the sign-in response details, and
   caches the `_ncfa` token in `.cache/ncfa_token.txt`.
3. (Optional) Override `GEOGUESSR_SIGNIN_URL` if GeoGuessr updates the sign-in
   endpoint.

### 2) Create a Discord Webhook

1. In Discord, go to your server → **Edit Channel** → **Integrations**.
2. Create a **Webhook**, select the target channel, and copy the URL.
3. Store it in `DISCORD_WEBHOOK_URL`.

### 3) Local Run

```bash
npm install
NCFA_TOKEN="..." DISCORD_WEBHOOK_URL="..." npm run start
```

```bash
npm install
GEOGUESSR_EMAIL="you@example.com" GEOGUESSR_PASSWORD="..." DISCORD_WEBHOOK_URL="..." npm run start
```

### Distance Assumption

GeoGuessr `totalDistance` appears to be either kilometers or meters. This app assumes values > 1000 are meters and converts to kilometers, otherwise uses the value as-is.

## Project Structure

```
.
├── .cache/                # cached token for idempotency
├── .cache/ncfa_token.txt   # cached _ncfa token from sign-in
├── .github/workflows/
│   └── daily.yml
├── src/
│   ├── discord.ts
│   ├── format.ts
│   ├── geoguessr.ts
│   └── index.ts
├── .env.example
├── package.json
└── tsconfig.json
```
