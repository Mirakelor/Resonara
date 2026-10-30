import {
  weatherSnapshotSchema,
  type ListeningContext,
  type WeatherCondition,
  type WeatherSnapshot,
} from "@resonara/contracts";
import {
  getProviderCache,
  setProviderCache,
} from "../../db/repositories/cache";
import { requestCurrentWeather } from "../providers/weather";

export type WeatherPayload = Awaited<
  ReturnType<typeof requestCurrentWeather>
>;
export type WeatherFetch = (
  latitude: number,
  longitude: number,
) => Promise<WeatherPayload>;

type WeatherOptions = {
  weatherFetch?: WeatherFetch;
  now?: () => Date;
};

const WEATHER_CACHE_MS = 15 * 60_000;

export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if ([1, 2].includes(code)) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "rain";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "unknown";
}

function mapPayload(payload: WeatherPayload, now: Date): WeatherSnapshot {
  return weatherSnapshotSchema.parse({
    temperatureC: payload.current.temperature_2m,
    apparentTemperatureC: payload.current.apparent_temperature,
    relativeHumidity: payload.current.relative_humidity_2m,
    condition: weatherCodeToCondition(payload.current.weather_code),
    isDay: Boolean(payload.current.is_day),
    observedAt: now.toISOString(),
  });
}

export async function getWeatherForCoords(
  latitude: number,
  longitude: number,
  options: WeatherOptions = {},
): Promise<WeatherSnapshot> {
  const now = options.now?.() ?? new Date();
  const roundedLatitude = Number(latitude.toFixed(2));
  const roundedLongitude = Number(longitude.toFixed(2));
  const cacheKey = `weather:${latitude.toFixed(1)}:${longitude.toFixed(1)}`;
  const cached = await getProviderCache(cacheKey, now);
  if (cached) {
    const parsed = weatherSnapshotSchema.safeParse(cached);
    if (parsed.success) return parsed.data;
  }

  const payload = await (options.weatherFetch ?? requestCurrentWeather)(
    roundedLatitude,
    roundedLongitude,
  );
  const weather = mapPayload(payload, now);
  await setProviderCache(
    cacheKey,
    weather,
    new Date(now.getTime() + WEATHER_CACHE_MS).toISOString(),
  );
  return weather;
}

export function getBrowserPosition(
  geolocation: Geolocation | undefined,
  timeoutMs = 8_000,
): Promise<GeolocationPosition> {
  if (!geolocation) {
    return Promise.reject(new Error("Geolocation is unavailable."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Location request timed out."));
    }, timeoutMs);

    geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(position);
      },
      (error) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(new Error(error.message));
      },
      {
        enableHighAccuracy: false,
        maximumAge: WEATHER_CACHE_MS,
        timeout: timeoutMs,
      },
    );
  });
}

export function createBaseContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): ListeningContext {
  return {
    localTime: now.toISOString(),
    timeZone,
    city: null,
    weather: null,
    weatherSource: "unavailable",
  };
}

export async function resolveDeviceContext(input: {
  geolocation?: Geolocation;
  weatherFetch?: WeatherFetch;
  now?: () => Date;
  timeZone?: string;
  timeoutMs?: number;
}): Promise<ListeningContext> {
  const now = input.now?.() ?? new Date();
  const base = createBaseContext(now, input.timeZone);

  try {
    const position = await getBrowserPosition(
      input.geolocation,
      input.timeoutMs,
    );
    const weather = await getWeatherForCoords(
      position.coords.latitude,
      position.coords.longitude,
      { weatherFetch: input.weatherFetch, now: input.now },
    );
    return {
      ...base,
      weather,
      weatherSource: "device",
    };
  } catch {
    return base;
  }
}
