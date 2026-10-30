import type {
  AIPlannerResult,
  ListeningContext,
  ListeningIntent,
  TasteProfile,
} from "@resonara/contracts";
import type { FavoriteRecord } from "@resonara/contracts";

export function buildLocalPlan(input: {
  profile: TasteProfile;
  favorites: FavoriteRecord[];
  context: ListeningContext;
  intent: ListeningIntent;
}): AIPlannerResult {
  const topGenre =
    input.favorites[0]?.enrichment?.genreTags[0] ??
    input.profile.topGenres[0] ??
    input.favorites[0]?.track.genre ??
    "melodic";
  const topArtist =
    input.profile.topArtists[0] ??
    input.favorites[0]?.track.artist ??
    "";
  const weather = input.context.weather?.condition ?? "any weather";
  const time = new Date(input.context.localTime);
  const hour = time.getHours();
  const timeOfDay =
    hour < 6
      ? "late night"
      : hour < 12
        ? "morning"
        : hour < 17
          ? "afternoon"
          : hour < 21
            ? "evening"
            : "night";
  const intentWords = input.intent.replaceAll("_", " ");

  return {
    searchQueries: [
      `${weather} ${timeOfDay} ${intentWords} ${topGenre}`,
      `${intentWords} ${topGenre} music`,
      `${timeOfDay} ${topGenre} melodic discovery`,
    ],
    artistDirections: topArtist ? [topArtist] : [],
    songDirections: [`${intentWords} ${topGenre}`],
    targetEnergy: input.profile.energyPreference,
    targetIntent: input.intent,
    rationale: `${timeOfDay} ${weather} context with a ${intentWords} direction.`,
    contextSummary: `${timeOfDay}, ${weather}, ${Math.round(
      input.context.weather?.apparentTemperatureC ?? 0,
    )}°C`,
    targetDimensions: {
      energy: input.profile.energyPreference,
      familiarity: input.profile.familiarityPreference,
      genres: input.profile.topGenres.slice(0, 6),
      languages: [],
    },
  };
}
