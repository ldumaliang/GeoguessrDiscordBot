import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  DailyChallengeResults,
  DailyChallengeRoundLocation,
  DailyFriendRoundResult,
} from "./geoguessr.js";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  district?: string;
  locality?: string;
  country?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

export type GeocodeOptions = {
  enabled?: boolean;
  baseUrl?: string;
  userAgent?: string;
  email?: string;
  language?: string;
  delayMs?: number;
  cachePath?: string;
  zoom?: number;
};

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_USER_AGENT = "GeoGuessrDiscordBot/1.0";
const DEFAULT_DELAY_MS = 1100;
const DEFAULT_CACHE_PATH = ".cache/geocode.json";
const DEFAULT_ZOOM = 10;

function pickLocality(address?: NominatimAddress): string | undefined {
  if (!address) {
    return undefined;
  }

  return (
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.municipality ??
    address.locality ??
    address.county ??
    address.district ??
    address.region ??
    address.state
  );
}

function buildLocationLabel(address?: NominatimAddress): string | null {
  const locality = pickLocality(address);
  const country = address?.country;

  if (locality && country) {
    return `${locality}, ${country}`;
  }

  if (country) {
    return country;
  }

  return null;
}

function buildCountryLabel(address?: NominatimAddress): string | null {
  if (address?.country) {
    return address.country;
  }
  return null;
}

function makeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

async function loadCache(path: string): Promise<Map<string, string | null>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

async function saveCache(
  path: string,
  cache: Map<string, string | null>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const payload: Record<string, string | null> = {};
  for (const [key, value] of cache.entries()) {
    payload[key] = value;
  }
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function fetchNominatimLocation(
  location: DailyChallengeRoundLocation,
  options: Required<Pick<GeocodeOptions, "baseUrl" | "userAgent">> &
    Pick<GeocodeOptions, "email" | "language" | "zoom">,
): Promise<string | null> {
  const url = new URL(options.baseUrl);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", location.lat.toString());
  url.searchParams.set("lon", location.lng.toString());
  url.searchParams.set("addressdetails", "1");

  if (typeof options.zoom === "number") {
    url.searchParams.set("zoom", String(options.zoom));
  }

  if (options.email) {
    url.searchParams.set("email", options.email);
  }

  const headers: HeadersInit = {
    "User-Agent": options.userAgent,
    Accept: "application/json",
  };

  if (options.language) {
    headers["Accept-Language"] = options.language;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NominatimResponse;
  return buildLocationLabel(data.address) ?? data.display_name ?? null;
}

async function fetchNominatimCountry(
  lat: number,
  lng: number,
  options: Required<Pick<GeocodeOptions, "baseUrl" | "userAgent">> &
    Pick<GeocodeOptions, "email" | "language">,
): Promise<string | null> {
  const url = new URL(options.baseUrl);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "3");

  if (options.email) {
    url.searchParams.set("email", options.email);
  }

  const headers: HeadersInit = {
    "User-Agent": options.userAgent,
    Accept: "application/json",
  };

  if (options.language) {
    headers["Accept-Language"] = options.language;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NominatimResponse;
  return buildCountryLabel(data.address);
}

async function enrichGuessCountries(
  rounds: DailyFriendRoundResult[] | undefined,
  cache: Map<string, string | null>,
  options: {
    baseUrl: string;
    userAgent: string;
    email?: string;
    language?: string;
    delayMs: number;
  },
): Promise<void> {
  if (!rounds || rounds.length === 0) {
    return;
  }

  for (const round of rounds) {
    if (
      round.guessedCountry ||
      round.guessLat == null ||
      round.guessLng == null
    ) {
      continue;
    }

    const key = `country:${makeCacheKey(round.guessLat, round.guessLng)}`;
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (cached) {
        round.guessedCountry = cached;
      }
      continue;
    }

    const country = await fetchNominatimCountry(
      round.guessLat,
      round.guessLng,
      {
        baseUrl: options.baseUrl,
        userAgent: options.userAgent,
        email: options.email,
        language: options.language,
      },
    );

    if (country) {
      round.guessedCountry = country;
    }

    cache.set(key, country);
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  }
}

export async function enrichDailyChallengeResultsWithLocations(
  daily: DailyChallengeResults,
  options: GeocodeOptions = {},
): Promise<void> {
  if (!daily.roundLocations || daily.roundLocations.length === 0) {
    return;
  }

  const enabled = options.enabled ?? true;
  if (!enabled) {
    return;
  }

  const resolvedBaseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const resolvedUserAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const resolvedDelayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const cachePath = options.cachePath ?? DEFAULT_CACHE_PATH;
  const resolvedZoom = options.zoom ?? DEFAULT_ZOOM;

  const cache = await loadCache(cachePath);

  for (const location of daily.roundLocations) {
    if (location.locationName) {
      continue;
    }
    const key = `round:${makeCacheKey(location.lat, location.lng)}`;
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (cached) {
        location.locationName = cached;
      }
      continue;
    }

    const label = await fetchNominatimLocation(location, {
      baseUrl: resolvedBaseUrl,
      userAgent: resolvedUserAgent,
      email: options.email,
      language: options.language,
      zoom: resolvedZoom,
    });

    if (label) {
      location.locationName = label;
    }

    cache.set(key, label);
    await new Promise((resolve) => setTimeout(resolve, resolvedDelayMs));
  }

  for (const friend of daily.results) {
    await enrichGuessCountries(friend.roundResults, cache, {
      baseUrl: resolvedBaseUrl,
      userAgent: resolvedUserAgent,
      email: options.email,
      language: options.language,
      delayMs: resolvedDelayMs,
    });
  }

  await saveCache(cachePath, cache);
}
