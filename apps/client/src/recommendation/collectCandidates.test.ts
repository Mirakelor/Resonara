import { describe, expect, it, vi } from "vitest";
import type {
  AIPlannerResult,
  ListeningContext,
} from "@resonara/contracts";
import type { NeteaseProvider } from "../services/netease/client";
import type { RawTrack } from "../services/netease/mappers";
import type { TasteSeed } from "./tasteSeed";
import {
  CANDIDATE_QUOTAS,
  collectCandidates,
} from "./collectCandidates";
import {
  aiExpansionSources,
  contextSearchSources,
  favoriteSimilarSources,
  sameDimensionSources,
} from "./sources/sourceFunctions";

const context: ListeningContext = {
  localTime: "2026-10-30T14:30:00+08:00",
  timeZone: "Asia/Shanghai",
  city: "Shanghai",
  weatherSource: "device",
  weather: {
    temperatureC: 28,
    apparentTemperatureC: 31,
    relativeHumidity: 75,
    condition: "cloudy",
    isDay: true,
    observedAt: "2026-10-30T14:00:00+08:00",
  },
};

const plan: AIPlannerResult = {
  searchQueries: ["rainy afternoon electronic", "warm melodic focus"],
  artistDirections: ["Chilli Beans."],
  songDirections: ["soft focus"],
  targetEnergy: 0.5,
  targetIntent: "focus",
  rationale: "A focused but warm afternoon.",
};

const seed: TasteSeed = {
  favoriteTrackId: "seed-1",
  artistIds: ["artist-1"],
  lyricists: ["Writer One"],
  composers: ["Composer One"],
  language: "Japanese",
  genreTags: ["电子"],
};

function raw(id: string, title = `Track ${id}`): RawTrack {
  return {
    id,
    title,
    artist: "Artist",
    artistIds: ["artist-1"],
    album: "Album",
    coverUrl: `https://cover.example.test/${id}.jpg`,
    durationMs: 180_000,
  };
}

function providerStub(
  overrides: Partial<NeteaseProvider> = {},
): NeteaseProvider {
  return {
    searchTracks: vi.fn().mockResolvedValue([]),
    getTrackDetails: vi.fn().mockImplementation((ids: string[]) =>
      Promise.resolve(ids.map((id) => raw(id))),
    ),
    getWikiSummary: vi.fn(),
    getLyrics: vi.fn(),
    getSimilarSongs: vi.fn().mockResolvedValue([]),
    getArtistSongs: vi.fn().mockResolvedValue([]),
    getPublicRecommendations: vi.fn().mockResolvedValue([]),
    getNewSongs: vi.fn().mockResolvedValue([]),
    resolvePlaybackUrls: vi.fn(),
    ...overrides,
  };
}

describe("candidate source lanes", () => {
  it("allocates the four primary lanes as 30, 25, 25, and 20 percent", () => {
    const total = Object.values(CANDIDATE_QUOTAS).reduce(
      (sum, value) => sum + value,
      0,
    );

    expect(total).toBe(80);
    expect(CANDIDATE_QUOTAS.favoriteSimilar / total).toBe(0.3);
    expect(CANDIDATE_QUOTAS.contextSearch / total).toBe(0.25);
    expect(CANDIDATE_QUOTAS.sameDimensions / total).toBe(0.25);
    expect(CANDIDATE_QUOTAS.aiExpansion / total).toBe(0.2);
  });

  it("uses only the three most recent favorites for similar songs", async () => {
    const provider = providerStub({
      getSimilarSongs: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve([raw(`similar-${id}`)]),
        ),
    });
    const seeds = ["1", "2", "3", "4"].map((id) => ({
      ...seed,
      favoriteTrackId: id,
    }));

    const sourced = await favoriteSimilarSources(
      provider,
      seeds,
      CANDIDATE_QUOTAS.favoriteSimilar,
    );

    expect(provider.getSimilarSongs).toHaveBeenCalledTimes(3);
    expect(sourced.map(({ source }) => source)).toEqual([
      "favorite_similarity",
      "favorite_similarity",
      "favorite_similarity",
    ]);
    expect(sourced[0]?.seedTrackId).toBe("1");
  });

  it("uses AI search queries for context search when available", async () => {
    const provider = providerStub({
      searchTracks: vi
        .fn()
        .mockImplementation((query: string) =>
          Promise.resolve([raw(query.includes("rainy") ? "rain" : "warm")]),
        ),
    });

    const sourced = await contextSearchSources(
      provider,
      plan,
      context,
      "focus",
      CANDIDATE_QUOTAS.contextSearch,
    );

    expect(provider.searchTracks).toHaveBeenCalledTimes(2);
    expect(provider.searchTracks).toHaveBeenNthCalledWith(
      1,
      "rainy afternoon electronic",
      expect.any(Number),
    );
    expect(sourced.map(({ source }) => source)).toEqual([
      "ai_context_search",
      "ai_context_search",
    ]);
  });

  it("builds deterministic context queries without AI", async () => {
    const provider = providerStub({
      searchTracks: vi.fn().mockResolvedValue([raw("fallback")]),
    });

    await contextSearchSources(
      provider,
      null,
      context,
      "relax",
      CANDIDATE_QUOTAS.contextSearch,
    );

    expect(provider.searchTracks).toHaveBeenCalled();
    expect(
      String((provider.searchTracks as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]),
    ).toMatch(/cloudy|afternoon|relax/i);
  });

  it("resolves AI artist and song directions through real search", async () => {
    const provider = providerStub({
      searchTracks: vi
        .fn()
        .mockImplementation((query: string) =>
          Promise.resolve([raw(query, query)]),
        ),
    });

    const sourced = await aiExpansionSources(
      provider,
      plan,
      CANDIDATE_QUOTAS.aiExpansion,
    );

    expect(provider.searchTracks).toHaveBeenCalledTimes(2);
    expect(sourced.map(({ source }) => source)).toEqual([
      "ai_artist_expansion",
      "ai_song_expansion",
    ]);
  });

  it("requires metadata for all five same-dimension lanes", async () => {
    const provider = providerStub({
      getArtistSongs: vi.fn().mockResolvedValue([raw("artist-match")]),
      searchTracks: vi.fn().mockImplementation((query: string) => {
        const ids: Record<string, string> = {
          "Writer One": "lyricist-match",
          "Composer One": "composer-match",
          Japanese: "language-match",
          "电子": "genre-match",
        };
        return Promise.resolve(ids[query] ? [raw(ids[query]!)] : []);
      }),
      getLyrics: vi.fn().mockImplementation((id: string) =>
        Promise.resolve({
          originalLrc: "[00:01.00]Lyrics",
          translationLrc: null,
          richLyrics: null,
          offsetMs: 0,
          hasLyrics: true,
          credits: {
            lyricists: id === "lyricist-match" ? ["Writer One"] : [],
            composers: id === "composer-match" ? ["Composer One"] : [],
            arrangers: [],
          },
        }),
      ),
      getWikiSummary: vi.fn().mockImplementation((id: string) =>
        Promise.resolve({
          credits: { lyricists: [], composers: [], arrangers: [] },
          genreTags: id === "genre-match" ? ["电子"] : [],
          recommendationTags: [],
          language: id === "language-match" ? "日语" : null,
          instrumental: false,
          bpm: null,
        }),
      ),
    });

    const sourced = await sameDimensionSources(
      provider,
      [seed],
      CANDIDATE_QUOTAS.sameDimensions,
    );

    expect(new Set(sourced.map(({ source }) => source))).toEqual(
      new Set([
        "same_artist",
        "same_lyricist",
        "same_composer",
        "same_language",
        "same_genre",
      ]),
    );
    expect(
      new Set(sourced.flatMap(({ matchedDimensions }) => matchedDimensions)),
    ).toEqual(
      new Set(["artist", "lyricist", "composer", "language", "genre"]),
    );
  });
});

describe("collectCandidates", () => {
  it("merges duplicate tracks and retains all provenance paths", async () => {
    const duplicate = raw("shared", "Shared");
    const provider = providerStub({
      searchTracks: vi.fn().mockResolvedValue([duplicate]),
      getPublicRecommendations: vi.fn().mockResolvedValue([duplicate]),
      getNewSongs: vi.fn().mockResolvedValue([duplicate]),
    });

    const candidates = await collectCandidates({
      provider,
      seeds: [],
      planner: null,
      context,
      intent: "relax",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.sources).toEqual(
      expect.arrayContaining([
        "ai_context_search",
        "recommend_songs",
        "personalized_newsong",
      ]),
    );
  });

  it("activates public fallback for cold start and fewer than twelve candidates", async () => {
    const provider = providerStub({
      searchTracks: vi.fn().mockResolvedValue([raw("primary")]),
      getPublicRecommendations: vi.fn().mockResolvedValue([raw("public")]),
      getNewSongs: vi.fn().mockResolvedValue([raw("new")]),
    });

    await collectCandidates({
      provider,
      seeds: [],
      planner: null,
      context,
      intent: "relax",
    });

    expect(provider.getPublicRecommendations).toHaveBeenCalledOnce();
    expect(provider.getNewSongs).toHaveBeenCalledOnce();
  });

  it("does not use public fallback when primary lanes yield twelve tracks", async () => {
    let call = 0;
    const provider = providerStub({
      searchTracks: vi.fn().mockImplementation(() => {
        const batch = Array.from({ length: 4 }, (_, index) =>
          raw(`${call}-${index}`),
        );
        call += 1;
        return Promise.resolve(batch);
      }),
    });

    await collectCandidates({
      provider,
      seeds: [
        {
          ...seed,
          artistIds: [],
          lyricists: [],
          composers: [],
          language: null,
          genreTags: [],
        },
      ],
      planner: null,
      context,
      intent: "relax",
    });

    expect(provider.getPublicRecommendations).not.toHaveBeenCalled();
    expect(provider.getNewSongs).not.toHaveBeenCalled();
  });

  it("caps the raw candidate pool at eighty tracks", async () => {
    let call = 0;
    const provider = providerStub({
      searchTracks: vi.fn().mockImplementation(() => {
        const batch = Array.from({ length: 30 }, (_, index) =>
          raw(`${call}-${index}`),
        );
        call += 1;
        return Promise.resolve(batch);
      }),
    });

    const candidates = await collectCandidates({
      provider,
      seeds: [],
      planner: null,
      context,
      intent: "relax",
    });

    expect(candidates.length).toBeLessThanOrEqual(80);
  });
});
