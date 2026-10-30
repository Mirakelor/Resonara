import { z } from "zod";
import { requestJson } from "../http";

const weatherResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number().int(),
    is_day: z.number().int(),
  }),
});

export type WeatherProviderSnapshot = z.infer<typeof weatherResponseSchema>;

export async function requestCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherProviderSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day",
  );
  url.searchParams.set("timezone", "auto");

  return requestJson(url.toString(), {}, weatherResponseSchema);
}
