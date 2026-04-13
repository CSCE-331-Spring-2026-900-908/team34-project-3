import { NextRequest, NextResponse } from "next/server";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
  };
};

type OpenMeteoReverseGeocodeResponse = {
  city?: string;
  town?: string;
  village?: string;
  locality?: string;
  county?: string;
  state?: string;
};

function parseCoordinate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function toFahrenheit(valueCelsius: number | undefined) {
  if (typeof valueCelsius !== "number") {
    return null;
  }

  return Math.round((valueCelsius * 9) / 5 + 32);
}

function toMph(valueKmh: number | undefined) {
  if (typeof valueKmh !== "number") {
    return null;
  }

  return Math.round(valueKmh * 0.621371);
}

function describeWeatherCode(code: number | undefined, isDay: number | undefined) {
  switch (code) {
    case 0:
      return isDay ? "Clear sky" : "Clear night";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
    case 63:
    case 65:
      return "Rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
    case 75:
      return "Snow";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Current conditions";
  }
}

export async function GET(request: NextRequest) {
  const lat = parseCoordinate(request.nextUrl.searchParams.get("lat"));
  const lon = parseCoordinate(request.nextUrl.searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "Latitude and longitude are required." }, { status: 400 });
  }

  const baseUrl = process.env.OPEN_METEO_BASE_URL ?? "https://api.open-meteo.com";
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timezone: "auto"
  });

  try {
    const [weatherResponse, geocodeResponse] = await Promise.all([
      fetch(`${baseUrl}/v1/forecast?${params.toString()}`, {
        cache: "no-store"
      }),
      fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?${new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          language: "en",
          format: "json"
        }).toString()}`,
        {
          cache: "no-store"
        }
      ).catch(() => null)
    ]);

    if (!weatherResponse.ok) {
      const message = `Unable to load weather right now. Open-Meteo returned HTTP ${weatherResponse.status}.`;
      console.error("Open-Meteo request failed:", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const payload = (await weatherResponse.json()) as OpenMeteoResponse;
    const current = payload.current;
    const geocodePayload = geocodeResponse?.ok
      ? ((await geocodeResponse.json()) as OpenMeteoReverseGeocodeResponse)
      : null;
    const locationName =
      geocodePayload?.city ??
      geocodePayload?.town ??
      geocodePayload?.village ??
      geocodePayload?.locality ??
      geocodePayload?.county ??
      geocodePayload?.state ??
      "Your area";

    return NextResponse.json({
      locationName,
      condition: describeWeatherCode(current?.weather_code, current?.is_day),
      description: describeWeatherCode(current?.weather_code, current?.is_day),
      iconCode: null,
      temperatureF: toFahrenheit(current?.temperature_2m),
      feelsLikeF: toFahrenheit(current?.apparent_temperature),
      humidity: typeof current?.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
      windMph: toMph(current?.wind_speed_10m)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Open-Meteo request threw:", message);
    return NextResponse.json({ error: `Unable to load weather right now. ${message}` }, { status: 502 });
  }
}
