import type {
  AIPlannerResult,
  ListeningContext,
  ListeningIntent,
} from "@resonara/contracts";
import type { NeteaseProvider } from "../../services/netease/client";
import type { SourcedRawTrack } from "./types";

function timeBucket(localTime: string) {
  const hour = new Date(localTime).getHours();
  if (hour < 6) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function buildDeterministicQueries(
  context: ListeningContext,
  intent: ListeningIntent,
): string[] {
  const bucket = timeBucket(context.localTime);
  const weather = context.weather?.condition ?? "any weather";
  const temperature =
    context.weather && context.weather.apparentTemperatureC >= 26
      ? "warm"
      : context.weather && context.weather.apparentTemperatureC <= 10
        ? "cold"
        : "mild";

  return [
    `${weather} ${bucket} ${intent.replaceAll("_", " ")} music`,
    `${temperature} ${intent.replaceAll("_", " ")} songs`,
    `${bucket} ${weather} melodic discovery`,
  ];
}

export async function contextSearchSources(
  provider: NeteaseProvider,
  plan: AIPlannerResult | null,
  context: ListeningContext,
  intent: ListeningIntent,
  limit: number,
): Promise<SourcedRawTrack[]> {
  const queries = plan?.searchQueries.length
    ? plan.searchQueries
    : buildDeterministicQueries(context, intent);
  if (queries.length === 0 || limit <= 0) return [];

  const perQuery = Math.max(1, Math.ceil(limit / queries.length));
  const lanes = await Promise.all(
    queries.map(async (query) => {
      const tracks = await provider.searchTracks(query, perQuery);
      return tracks.map<SourcedRawTrack>((raw) => ({
        raw,
        source: "ai_context_search",
        seedTrackId: null,
        matchedDimensions: [],
      }));
    }),
  );

  return lanes.flat().slice(0, limit);
}
