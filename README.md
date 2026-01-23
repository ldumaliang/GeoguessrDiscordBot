# GeoGuessr Daily Friends → Discord

Fetch today’s GeoGuessr Daily Challenge friends leaderboard and post it to a Discord channel via a webhook.

## Features

- GeoGuessr Daily Challenge “friends” leaderboard for the logged-in account.
- Discord webhook post with a clean, table-like message plus per-round details.
- Retries with exponential backoff for transient errors (429/5xx).
- Optional idempotency via a cached daily token.
- Scheduled daily via GitHub Actions.

## Prerequisites

- Node.js 20+
- A GeoGuessr session cookie
- A Discord webhook URL
- (Optional) A Discord webhook URL for pull request runs (GitHub Actions secret)

## Setup

### 1) Get `GEOGUESSR_COOKIE`

1. Log into GeoGuessr in your browser.
2. Open DevTools → **Application** (Chrome) or **Storage** (Firefox).
3. Under **Cookies**, select `https://www.geoguessr.com`.
4. Copy the full cookie string (e.g. `_ncfa=...; othercookie=...`).
5. Store it in an environment variable named `GEOGUESSR_COOKIE`.

### 2) Create a Discord Webhook

1. In Discord, go to your server → **Edit Channel** → **Integrations**.
2. Create a **Webhook**, select the target channel, and copy the URL.
3. Store it in `DISCORD_WEBHOOK_URL`.
4. (Optional) For GitHub pull request runs, store a private test webhook URL in
   the `DISCORD_WEBHOOK_URL_PR` Actions secret so PRs post to a safe channel.

### 3) Local Run

```bash
npm install
GEOGUESSR_COOKIE="..." DISCORD_WEBHOOK_URL="..." npm run start
```

For pull request CI runs, set the `DISCORD_WEBHOOK_URL_PR` GitHub Actions secret.
The workflow uses it to route PR runs to the test webhook while still using
`DISCORD_WEBHOOK_URL` for scheduled runs.

### Distance Assumption

GeoGuessr `totalDistance` appears to be either kilometers or meters. This app assumes values > 1000 are meters and converts to kilometers, otherwise uses the value as-is.

### Per-Round Details

When the daily challenge token is available, the app fetches the friends results
endpoint to add round-by-round breakdowns (time taken, steps, score, guessed
country) and the round locations (latitude/longitude) to the Discord post.

### Reverse Geocoding (Town/Country)

The app can resolve round coordinates to a town and country using the public
Nominatim reverse geocoding API. It rate-limits requests, caches results locally,
and includes OpenStreetMap attribution in the Discord post.

Env config:
- `GEOCODE_LOCATIONS` (default: true)
- `NOMINATIM_BASE_URL` (optional override)
- `NOMINATIM_USER_AGENT` (required by Nominatim usage policy)
- `NOMINATIM_EMAIL` (optional)
- `NOMINATIM_LANGUAGE` (optional, e.g. `en`)
- `NOMINATIM_DELAY_MS` (default: 1100)
- `NOMINATIM_CACHE_PATH` (default: `.cache/geocode.json`)
- `NOMINATIM_ZOOM` (default: 10; 10 ~= city-level)

## Project Structure

```
.
├── .cache/                # cached token for idempotency
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
