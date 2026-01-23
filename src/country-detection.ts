/**
 * Country detection for GeoGuessr guesses
 *
 * Determines if a guess is in the correct country by reverse geocoding both
 * the actual location and the guess location.
 */

// Simple sleep utility
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Location {
  lat: number;
  lng: number;
}

export interface CountryCheckResult {
  actualCountry: string | null;
  guessedCountry: string | null;
  correct: boolean;
  error?: string;
}

/**
 * Reverse geocode a location to get its country using Nominatim
 * (OpenStreetMap's geocoding service)
 */
export async function getCountryFromLocation(
  location: Location,
  options: {
    baseUrl?: string;
    userAgent?: string;
    delayMs?: number;
  } = {},
): Promise<string | null> {
  const {
    baseUrl = "https://nominatim.openstreetmap.org",
    userAgent = "GeoGuesserDiscordBot/1.0",
    delayMs = 1000,
  } = options;

  try {
    // Be respectful of Nominatim's usage policy - add delay
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const url = `${baseUrl}/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=3&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
      },
    });

    if (!response.ok) {
      console.warn(
        `Nominatim request failed with status ${response.status} for ${location.lat},${location.lng}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      address?: { country_code?: string };
    };

    return data.address?.country_code?.toUpperCase() || null;
  } catch (error) {
    console.warn(
      `Failed to geocode location ${location.lat},${location.lng}:`,
      error,
    );
    return null;
  }
}

/**
 * Check if a guess is in the correct country
 *
 * @param actualLocation The actual round location
 * @param guessLocation The player's guessed location
 * @param options Geocoding options
 * @returns Result indicating if the country is correct
 */
export async function checkCorrectCountry(
  actualLocation: Location,
  guessLocation: Location,
  options?: {
    baseUrl?: string;
    userAgent?: string;
    delayMs?: number;
  },
): Promise<CountryCheckResult> {
  try {
    const [actualCountry, guessedCountry] = await Promise.all([
      getCountryFromLocation(actualLocation, options),
      getCountryFromLocation(guessLocation, options),
    ]);

    return {
      actualCountry,
      guessedCountry,
      correct:
        actualCountry !== null &&
        guessedCountry !== null &&
        actualCountry === guessedCountry,
    };
  } catch (error) {
    return {
      actualCountry: null,
      guessedCountry: null,
      correct: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch check countries for multiple rounds
 * Includes rate limiting to respect API limits
 */
export async function batchCheckCountries(
  rounds: Array<{
    actualLocation: Location;
    guessLocation: Location;
  }>,
  options?: {
    baseUrl?: string;
    userAgent?: string;
    delayMs?: number;
  },
): Promise<CountryCheckResult[]> {
  const results: CountryCheckResult[] = [];

  for (const round of rounds) {
    const result = await checkCorrectCountry(
      round.actualLocation,
      round.guessLocation,
      options,
    );
    results.push(result);
  }

  return results;
}

/**
 * Simple fallback: approximate country detection based on lat/lng ranges
 * This is much less accurate but doesn't require API calls
 *
 * IMPORTANT: This is a very rough approximation and should only be used
 * when API-based geocoding is not available
 */
export function approximateCountry(location: Location): string | null {
  const { lat, lng } = location;

  // Very rough approximations for major regions
  // This is NOT accurate and should be used with caution

  // Australia
  if (lat < -10 && lat > -44 && lng > 113 && lng < 154) return "AU";

  // USA (continental + Alaska)
  if (
    (lat > 24 && lat < 50 && lng > -125 && lng < -66) ||
    (lat > 51 && lat < 72 && lng > -180 && lng < -130)
  )
    return "US";

  // Canada
  if (lat > 41 && lat < 84 && lng > -141 && lng < -52) return "CA";

  // Brazil
  if (lat < 5 && lat > -34 && lng > -74 && lng < -35) return "BR";

  // Europe (very rough)
  if (lat > 36 && lat < 71 && lng > -10 && lng < 40) {
    // Sub-regions
    if (lat > 45 && lng > 20 && lng < 40) return "RU"; // Russia (European part)
    if (lat > 50 && lng < 15) return "DE"; // Rough Germany area
    if (lat > 40 && lat < 52 && lng > -5 && lng < 2) return "FR"; // Rough France
    if (lat > 36 && lat < 44 && lng > -9 && lng < 4) return "ES"; // Rough Spain
    return "EU"; // Generic Europe
  }

  // Russia (Asian part)
  if (lat > 41 && lat < 78 && lng > 40 && lng < 180) return "RU";

  // China
  if (lat > 18 && lat < 54 && lng > 73 && lng < 135) return "CN";

  // India
  if (lat > 8 && lat < 37 && lng > 68 && lng < 97) return "IN";

  // Japan
  if (lat > 24 && lat < 46 && lng > 123 && lng < 146) return "JP";

  // South Africa
  if (lat < -22 && lat > -35 && lng > 16 && lng < 33) return "ZA";

  // Argentina
  if (lat < -22 && lat > -55 && lng > -73 && lng < -53) return "AR";

  // Mexico
  if (lat > 14 && lat < 33 && lng > -118 && lng < -86) return "MX";

  return null; // Unknown
}

/**
 * Check if guess is in correct country using approximation
 * Much faster but less accurate than API-based method
 */
export function approximateCountryMatch(
  actualLocation: Location,
  guessLocation: Location,
): boolean {
  const actualCountry = approximateCountry(actualLocation);
  const guessedCountry = approximateCountry(guessLocation);

  return (
    actualCountry !== null &&
    guessedCountry !== null &&
    actualCountry === guessedCountry
  );
}
