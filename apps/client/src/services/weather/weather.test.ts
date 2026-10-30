import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resonaraDb } from "../../db/database";
import {
  getWeatherForCoords,
  resolveDeviceContext,
  weatherCodeToCondition,
  type WeatherFetch,
} from "./openMeteo";

const now = new Date("2026-10-30T15:00:00+08:00");

const weatherPayload = {
  current: {
    time: "2026-10-30T15:00",
    temperature_2m: 28,
    apparent_temperature: 31,
    relative_humidity_2m: 75,
    weather_code: 3,
    is_day: 1,
  },
};

function successfulGeolocation(
  latitude = 31.2304,
  longitude = 121.4737,
) {
  return {
    getCurrentPosition: vi.fn().mockImplementation(
      (success: PositionCallback) =>
        success({
          coords: {
            latitude,
            longitude,
            accuracy: 100,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: now.getTime(),
          toJSON: () => ({}),
        } as GeolocationPosition),
    ),
  } as unknown as Geolocation;
}

function deniedGeolocation() {
  return {
    getCurrentPosition: vi.fn().mockImplementation(
      (_success: PositionCallback, error?: PositionErrorCallback) =>
        error?.({
          code: 1,
          message: "Permission denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError),
    ),
  } as unknown as Geolocation;
}

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
}

describe("weather context", () => {
  beforeEach(resetDatabase);
  afterEach(() => resonaraDb.close());

  it("maps Open-Meteo weather codes into product conditions", () => {
    expect(weatherCodeToCondition(0)).toBe("clear");
    expect(weatherCodeToCondition(3)).toBe("cloudy");
    expect(weatherCodeToCondition(61)).toBe("rain");
    expect(weatherCodeToCondition(71)).toBe("snow");
    expect(weatherCodeToCondition(95)).toBe("storm");
    expect(weatherCodeToCondition(45)).toBe("fog");
  });

  it("builds a listening context from coarse weather data", async () => {
    const weatherFetch = vi.fn().mockResolvedValue(weatherPayload);

    const context = await resolveDeviceContext({
      geolocation: successfulGeolocation(),
      weatherFetch,
      now: () => now,
      timeZone: "Asia/Shanghai",
      timeoutMs: 100,
    });

    expect(context).toMatchObject({
      city: null,
      timeZone: "Asia/Shanghai",
      weatherSource: "device",
      weather: {
        temperatureC: 28,
        apparentTemperatureC: 31,
        relativeHumidity: 75,
        condition: "cloudy",
        isDay: true,
      },
    });
    expect(weatherFetch).toHaveBeenCalledWith(31.23, 121.47);
  });

  it("keeps recommending without weather when permission is denied", async () => {
    const context = await resolveDeviceContext({
      geolocation: deniedGeolocation(),
      weatherFetch: vi.fn(),
      now: () => now,
      timeZone: "Asia/Shanghai",
      timeoutMs: 100,
    });

    expect(context.weather).toBeNull();
    expect(context.weatherSource).toBe("unavailable");
  });

  it("returns without weather when geolocation times out", async () => {
    const geolocation = {
      getCurrentPosition: vi.fn(),
    } as unknown as Geolocation;

    const context = await resolveDeviceContext({
      geolocation,
      weatherFetch: vi.fn(),
      now: () => now,
      timeZone: "Asia/Shanghai",
      timeoutMs: 5,
    });

    expect(context.weather).toBeNull();
    expect(context.weatherSource).toBe("unavailable");
  });

  it("reuses weather from IndexedDB for fifteen minutes", async () => {
    const weatherFetch: WeatherFetch = vi
      .fn()
      .mockResolvedValue(weatherPayload);

    const first = await getWeatherForCoords(31.234, 121.478, {
      weatherFetch,
      now: () => now,
    });
    const second = await getWeatherForCoords(31.231, 121.471, {
      weatherFetch,
      now: () => new Date(now.getTime() + 10 * 60_000),
    });

    expect(first).toEqual(second);
    expect(weatherFetch).toHaveBeenCalledOnce();
  });
});
