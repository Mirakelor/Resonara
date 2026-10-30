import type { NeteaseProvider } from "../../services/netease/client";
import type { TasteSeed } from "../tasteSeed";
import type { SourcedRawTrack } from "./types";

export async function favoriteSimilarSources(
  provider: NeteaseProvider,
  seeds: TasteSeed[],
  limit: number,
): Promise<SourcedRawTrack[]> {
  const recentSeeds = seeds.slice(0, 3);
  if (recentSeeds.length === 0 || limit <= 0) return [];

  const perSeed = Math.max(1, Math.ceil(limit / recentSeeds.length));
  const lanes = await Promise.all(
    recentSeeds.map(async (seed) => {
      const tracks = await provider.getSimilarSongs(
        seed.favoriteTrackId,
        perSeed,
      );
      return tracks.map<SourcedRawTrack>((raw) => ({
        raw,
        source: "favorite_similarity",
        seedTrackId: seed.favoriteTrackId,
        matchedDimensions: [],
      }));
    }),
  );

  return lanes.flat().slice(0, limit);
}
