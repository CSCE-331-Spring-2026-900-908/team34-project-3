"use client";

import { CloudSun, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

type WeatherPayload = {
  locationName: string;
  condition: string;
  description: string;
  iconCode: string | null;
  temperatureF: number | null;
  feelsLikeF: number | null;
  humidity: number | null;
  windMph: number | null;
};

type WeatherState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: WeatherPayload };

export function CustomerWeatherCard() {
  const [weatherState, setWeatherState] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setWeatherState({ status: "error", message: "Location services are not available on this device." });
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude)
          });

          const response = await fetch(`/api/weather/current?${params.toString()}`, {
            cache: "no-store"
          });

          const payload = (await response.json().catch(() => null)) as WeatherPayload | { error?: string } | null;

          if (!response.ok) {
            throw new Error(payload && typeof payload === "object" && "error" in payload ? payload.error : "Unable to load weather.");
          }

          if (!cancelled) {
            setWeatherState({ status: "ready", payload: payload as WeatherPayload });
          }
        } catch (error) {
          if (!cancelled) {
            setWeatherState({
              status: "error",
              message: error instanceof Error ? error.message : "Unable to load weather."
            });
          }
        }
      },
      (error) => {
        if (cancelled) {
          return;
        }

        const message =
          error.code === error.PERMISSION_DENIED
            ? "Allow location access to see local weather."
            : "We could not determine your location for weather.";

        setWeatherState({ status: "error", message });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Local Weather</p>
          {weatherState.status === "ready" ? (
            <>
              <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
                <MapPin className="h-4 w-4" />
                <span>{weatherState.payload.locationName}</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {weatherState.payload.temperatureF !== null ? `${weatherState.payload.temperatureF}°F` : "--"}
              </p>
              <p className="mt-1 text-sm text-stone-600 capitalize">{weatherState.payload.description}</p>
              <p className="mt-2 text-sm text-stone-500">
                Feels like {weatherState.payload.feelsLikeF ?? "--"}°F | Humidity {weatherState.payload.humidity ?? "--"}%
              </p>
              <p className="mt-1 text-sm text-stone-500">Wind {weatherState.payload.windMph ?? "--"} mph</p>
            </>
          ) : null}

          {weatherState.status === "loading" ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading your local weather...</span>
            </div>
          ) : null}

          {weatherState.status === "error" ? (
            <p className="mt-3 text-sm text-stone-600">{weatherState.message}</p>
          ) : null}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white text-foreground">
          {weatherState.status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudSun className="h-5 w-5" />}
        </div>
      </div>
    </div>
  );
}
