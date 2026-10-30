import type { NeteaseProvider } from "../../services/netease/client";
import { findCreditMatches } from "../../services/netease/creditSearch";
import {
  normalizeLanguageTag,
  verifyTagMatches,
  type TasteSeed,
} from "../tasteSeed";
import type {
  MatchedDimension,
  SourcedRawTrack,
} from "./types";

function sourced(
  raw: SourcedRawTrack["raw"],
  source: SourcedRawTrack["source"],
  seedTrackId: string,
  dimension: MatchedDimension,
): SourcedRawTrack {
  return {
    raw,
    source,
    seedTrackId,
    matchedDimensions: [dimension],
  };
}

async function artistLane(
  provider: NeteaseProvider,
  seed: TasteSeed,
  limit: number,
) {
  const lanes = await Promise.all(
    seed.artistIds.map((artistId) =>
      provider.getArtistSongs(artistId, limit),
    ),
  );
  return lanes
    .flat()
    .map((raw) =>
      sourced(raw, "same_artist", seed.favoriteTrackId, "artist"),
    );
}

async function creditLane(
  provider: NeteaseProvider,
  seed: TasteSeed,
  role: "lyricist" | "composer",
  names: string[],
  limit: number,
) {
  const lanes = await Promise.all(
    names.map((name) => findCreditMatches(provider, role, name, limit)),
  );
  return lanes.flat().map((raw) =>
    sourced(
      raw,
      role === "lyricist" ? "same_lyricist" : "same_composer",
      seed.favoriteTrackId,
      role,
    ),
  );
}

async function tagLane(
  provider: NeteaseProvider,
  seed: TasteSeed,
  dimension: "language" | "genre",
  values: string[],
  limit: number,
) {
  const lanes = await Promise.all(
    values.map(async (value) => {
      const candidates = await provider.searchTracks(value, limit * 2);
      const verified = await verifyTagMatches(
        provider,
        candidates,
        dimension,
        value,
      );
      return verified.map((raw) =>
        sourced(
          raw,
          dimension === "language" ? "same_language" : "same_genre",
          seed.favoriteTrackId,
          dimension,
        ),
      );
    }),
  );
  return lanes.flat();
}

export async function sameDimensionSources(
  provider: NeteaseProvider,
  seeds: TasteSeed[],
  limit: number,
): Promise<SourcedRawTrack[]> {
  const selectedSeeds = seeds.slice(0, 3);
  if (selectedSeeds.length === 0 || limit <= 0) return [];

  const perSeed = Math.max(1, Math.ceil(limit / selectedSeeds.length));
  const lanes = await Promise.all(
    selectedSeeds.map(async (seed) => {
      const language = seed.language
        ? normalizeLanguageTag(seed.language)
        : null;
      const [artist, lyricists, composers, languages, genres] =
        await Promise.all([
          artistLane(provider, seed, perSeed),
          creditLane(
            provider,
            seed,
            "lyricist",
            seed.lyricists,
            perSeed,
          ),
          creditLane(
            provider,
            seed,
            "composer",
            seed.composers,
            perSeed,
          ),
          language ? tagLane(provider, seed, "language", [language], perSeed) : [],
          tagLane(provider, seed, "genre", seed.genreTags, perSeed),
        ]);

      return [
        ...artist,
        ...lyricists,
        ...composers,
        ...languages,
        ...genres,
      ];
    }),
  );

  return lanes.flat().slice(0, limit);
}
