import type { AIPlannerResult } from "@resonara/contracts";
import type { NeteaseProvider } from "../../services/netease/client";
import type { SourcedRawTrack } from "./types";

export async function aiExpansionSources(
  provider: NeteaseProvider,
  plan: AIPlannerResult | null,
  limit: number,
): Promise<SourcedRawTrack[]> {
  if (!plan || limit <= 0) return [];

  const directions = [
    ...plan.artistDirections.map((query) => ({
      query,
      source: "ai_artist_expansion" as const,
    })),
    ...plan.songDirections.map((query) => ({
      query,
      source: "ai_song_expansion" as const,
    })),
  ];
  if (directions.length === 0) return [];

  const perDirection = Math.max(1, Math.ceil(limit / directions.length));
  const lanes = await Promise.all(
    directions.map(async ({ query, source }) => {
      const tracks = await provider.searchTracks(query, perDirection);
      return tracks.map<SourcedRawTrack>((raw) => ({
        raw,
        source,
        seedTrackId: null,
        matchedDimensions: [],
      }));
    }),
  );

  return lanes.flat().slice(0, limit);
}
