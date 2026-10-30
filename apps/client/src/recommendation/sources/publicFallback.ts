import type { NeteaseProvider } from "../../services/netease/client";
import type { SourcedRawTrack } from "./types";

export async function publicFallbackSources(
  provider: NeteaseProvider,
  limit: number,
): Promise<SourcedRawTrack[]> {
  if (limit <= 0) return [];

  const [recommended, newSongs] = await Promise.all([
    provider.getPublicRecommendations().catch(() => []),
    provider.getNewSongs(limit).catch(() => []),
  ]);

  return [
    ...recommended.map<SourcedRawTrack>((raw) => ({
      raw,
      source: "recommend_songs",
      seedTrackId: null,
      matchedDimensions: [],
    })),
    ...newSongs.map<SourcedRawTrack>((raw) => ({
      raw,
      source: "personalized_newsong",
      seedTrackId: null,
      matchedDimensions: [],
    })),
  ].slice(0, limit);
}
