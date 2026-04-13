"use client";

import { CloudSun, Loader2, MapPin, Wind } from "lucide-react";
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

export function CustomerWeatherWidget() {
  const [weatherState, setWeatherState] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setWeatherState({ status: "error", message: "Weather unavailable" });
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
            throw new Error(payload && typeof payload === "object" && "error" in payload ? payload.error : "Weather unavailable");
          }

          if (!cancelled) {
            setWeatherState({ status: "ready", payload: payload as WeatherPayload });
          }
        } catch {
          if (!cancelled) {
            setWeatherState({ status: "error", message: "Weather unavailable" });
          }
        }
      },
      () => {
        if (!cancelled) {
          setWeatherState({ status: "error", message: "Weather unavailable" });
        }
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
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
      {weatherState.status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading weather...</span>
        </div>
      ) : null}

      {weatherState.status === "error" ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <CloudSun className="h-4 w-4" />
          <span>{weatherState.message}</span>
        </div>
      ) : null}

      {weatherState.status === "ready" ? (
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">
            <CloudSun className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{weatherState.payload.locationName}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-stone-900">
                {weatherState.payload.temperatureF !== null ? `${weatherState.payload.temperatureF}°F` : "--"}
              </span>
              <span className="truncate text-sm text-stone-600 capitalize">{weatherState.payload.description}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
              <Wind className="h-3.5 w-3.5" />
              <span>Feels like {weatherState.payload.feelsLikeF ?? "--"}°F</span>
              <span>|</span>
              <span>{weatherState.payload.windMph ?? "--"} mph</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
