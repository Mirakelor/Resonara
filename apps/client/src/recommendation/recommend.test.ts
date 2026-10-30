import { describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  FavoriteRecord,
  ListeningContext,
  RecommendationBatch,
  TasteProfile,
  Track,
} from "@resonara/contracts";
import type { NeteaseProvider } from "../services/netease/client";
import type { RawTrack } from "../services/netease/mappers";
import {
  generateRecommendationBatch,
  isRecommendationBatchPlayable,
} from "./recommend";

const settings: AppSettings = {
  musicApiBaseUrl: "https://music.example.test",
  musicApiToken: "",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: "",
};

const context: ListeningContext = {
  localTime: "2026-10-30T15:00:00+08:00",
  timeZone: "Asia/Shanghai",
  city: null,
  weatherSource: "device",
  weather: {
    temperatureC: 28,
    apparentTemperatureC: 31,
    relativeHumidity: 75,
    condition: "cloudy",
    isDay: true,
    observedAt: "2026-10-30T15:00:00+08:00",
  },
};

const profile: TasteProfile = {
  updatedAt: "2026-10-30T15:00:00+08:00",
  topGenres: ["Electronic"],
  topArtists: ["Artist A"],
  energyPreference: 0.5,
  familiarityPreference: 0.5,
  contextAffinities: [],
};

function raw(id: string): RawTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    artistIds: [`artist-${id}`],
    album: "Album",
    coverUrl: `https://cover.example.test/${id}.jpg`,
    durationMs: 180_000,
  };
}

function providerStub(
  playableIds: string[] = ["a", "b", "c", "d", "e", "f"],
): NeteaseProvider {
  const tracks = playableIds.map(raw);
  return {
    searchTracks: vi.fn().mockResolvedValue(tracks),
    getTrackDetails: vi
      .fn()
      .mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map((id) => raw(id))),
      ),
    getWikiSummary: vi.fn().mockResolvedValue({
      credits: { lyricists: [], composers: [], arrangers: [] },
      genreTags: ["Electronic"],
      recommendationTags: [],
      language: "English",
      instrumental: false,
      bpm: null,
    }),
    getLyrics: vi.fn().mockResolvedValue({
      originalLrc: "[00:01.00]Line",
      translationLrc: null,
      richLyrics: null,
      offsetMs: 0,
      hasLyrics: true,
      credits: { lyricists: [], composers: [], arrangers: [] },
    }),
    getSimilarSongs: vi.fn().mockResolvedValue(tracks.slice(0, 3)),
    getArtistSongs: vi.fn().mockResolvedValue(tracks.slice(1, 4)),
    getPublicRecommendations: vi.fn().mockResolvedValue(tracks),
    getNewSongs: vi.fn().mockResolvedValue(tracks.slice(2)),
    resolvePlaybackUrls: vi.fn().mockImplementation((ids: string[]) =>
      Promise.resolve(
        new Map(
          ids.map((id) => [
            id,
            {
              trackId: id,
              url: `https://audio.example.test/${id}.mp3`,
              expiresAt: "2026-10-30T17:00:00+08:00",
              level: "standard" as const,
              playable: true,
              unavailableReason: null,
              mediaType: "mp3",
            },
          ]),
        ),
      ),
    ),
  };
}

function favorite(): FavoriteRecord {
  const track: Track = {
    id: "favorite-1",
    provider: "netease",
    title: "Favorite",
    artist: "Artist A",
    artistIds: ["artist-a"],
    album: "Album",
    coverUrl: "https://cover.example.test/favorite.jpg",
    genre: "Electronic",
    energyLabel: "Mid-tempo",
    energy: 0.5,
    durationMs: 180_000,
    playable: true,
  };
  return {
    trackId: track.id,
    track,
    enrichment: {
      credits: { lyricists: ["Writer"], composers: ["Composer"], arrangers: [] },
      genreTags: ["Electronic"],
      recommendationTags: [],
      language: "English",
      instrumental: false,
      bpm: null,
    },
    createdAt: "2026-10-30T14:00:00+08:00",
    updatedAt: "2026-10-30T14:00:00+08:00",
    lastVerifiedAt: "2026-10-30T14:00:00+08:00",
  };
}

describe("final recommendation assembly", () => {
  it("produces exactly three anonymous playable tracks on cold start", async () => {
    const batch = await generateRecommendationBatch(
      {
        settings,
        profile,
        favorites: [],
        context,
        environmentMode: "use_current",
        intent: "relax",
        recentEvents: [],
      },
      {
        provider: providerStub(),
        persist: vi.fn(),
        now: () => new Date("2026-10-30T15:00:00+08:00"),
        random: () => 0,
      },
    );

    expect(batch.items).toHaveLength(3);
    expect(batch.items.every(({ track }) => track.playable)).toBe(true);
    expect(batch.featuredTrackId).toBe(batch.items[0]?.track.id);
  });

  it("uses favorite seeds and preserves candidate provenance", async () => {
    const provider = providerStub();
    const batch = await generateRecommendationBatch(
      {
        settings,
        profile,
        favorites: [favorite()],
        context,
        environmentMode: "use_current",
        intent: "focus",
        recentEvents: [],
      },
      {
        provider,
        persist: vi.fn(),
        now: () => new Date("2026-10-30T15:00:00+08:00"),
      },
    );

    expect(provider.getSimilarSongs).toHaveBeenCalled();
    expect(
      batch.items.some(({ sources }) =>
        sources?.includes("favorite_similarity"),
      ),
    ).toBe(true);
  });

  it("forces a clicked Discover seed into the final batch", async () => {
    const batch = await generateRecommendationBatch(
      {
        settings,
        profile,
        favorites: [],
        context,
        environmentMode: "use_current",
        intent: "comfort",
        recentEvents: [],
        seedTrackId: "z",
      },
      {
        provider: providerStub(["a", "b", "c", "d"]),
        persist: vi.fn(),
        now: () => new Date("2026-10-30T15:00:00+08:00"),
      },
    );

    expect(batch.items.map(({ track }) => track.id)).toContain("z");
  });

  it("rejects a cached batch when any fresh URL check fails", async () => {
    const provider = providerStub(["a", "b", "c"]);
    const batch = await generateRecommendationBatch(
      {
        settings,
        profile,
        favorites: [],
        context,
        environmentMode: "use_current",
        intent: "relax",
        recentEvents: [],
      },
      {
        provider,
        persist: vi.fn(),
        now: () => new Date("2026-10-30T15:00:00+08:00"),
      },
    );

    vi.mocked(provider.resolvePlaybackUrls).mockResolvedValue(
      new Map(
        batch.items.map(({ track }) => [
          track.id,
          {
            trackId: track.id,
            url: null,
            expiresAt: null,
            level: "standard" as const,
            playable: false,
            unavailableReason: "No URL",
          },
        ]),
      ),
    );

    await expect(
      isRecommendationBatchPlayable(
        batch as RecommendationBatch,
        provider,
        new Date("2026-10-30T16:00:00+08:00"),
      ),
    ).resolves.toBe(false);
  });
});
