import { describe, expect, it, vi } from "vitest";
import type {
  FavoriteRecord,
  Track,
  TrackEnrichment,
} from "@resonara/contracts";
import {
  buildTasteSeed,
  findCreditMatches,
  normalizeLanguageTag,
  verifyTagMatches,
} from "./tasteSeed";

const track: Track = {
  id: "track-1",
  provider: "netease",
  title: "Undefined",
  artist: "PerVade / 第五人格",
  artistIds: ["100", "200"],
  album: "Undefined",
  coverUrl: "https://cover.example.test/undefined.jpg",
  genre: "Electronic",
  energyLabel: "Mid-tempo",
  energy: 0.58,
  durationMs: 175915,
  playable: true,
};

const enrichment: TrackEnrichment = {
  credits: {
    lyricists: ["大九_LN", "人锦Renjin"],
    composers: ["胡臻koshin", "人锦Renjin"],
    arrangers: ["Arranger One"],
  },
  genreTags: ["电子", "另类/独立"],
  recommendationTags: ["活力"],
  language: "日语",
  instrumental: false,
  bpm: 125,
};

const favorite: FavoriteRecord = {
  trackId: track.id,
  track,
  enrichment,
  createdAt: "2026-10-30T14:30:00+08:00",
  updatedAt: "2026-10-30T14:30:00+08:00",
  lastVerifiedAt: "2026-10-30T14:30:00+08:00",
};

function rawTrack(id: string, title: string) {
  return {
    id,
    title,
    artist: "Artist",
    artistIds: ["artist-1"],
    album: "Album",
    coverUrl: "https://cover.example.test/album.jpg",
    durationMs: 180_000,
  };
}

function lyrics(lyricists: string[], composers: string[]) {
  return {
    originalLrc: "[00:01.00]Lyrics",
    translationLrc: null,
    richLyrics: null,
    offsetMs: 0,
    hasLyrics: true,
    credits: {
      lyricists,
      composers,
      arrangers: [],
    },
  };
}

describe("taste seeds", () => {
  it("builds one five-dimension seed from a favorite", () => {
    expect(buildTasteSeed(favorite)).toEqual({
      favoriteTrackId: "track-1",
      artistIds: ["100", "200"],
      lyricists: ["大九_LN", "人锦Renjin"],
      composers: ["胡臻koshin", "人锦Renjin"],
      language: "Japanese",
      genreTags: ["电子", "另类/独立"],
    });
  });

  it("maps Netease language tags into stable dimensions", () => {
    expect(normalizeLanguageTag("日语")).toBe("Japanese");
    expect(normalizeLanguageTag("英语")).toBe("English");
    expect(normalizeLanguageTag("纯音乐")).toBeNull();
  });

  it("keeps only candidates with an exact verified composer credit", async () => {
    const provider = {
      searchTracks: vi.fn().mockResolvedValue([
        rawTrack("1", "Match"),
        rawTrack("2", "Wrong composer"),
        rawTrack("3", "No credits"),
      ]),
      getLyrics: vi
        .fn()
        .mockResolvedValueOnce(lyrics([], ["胡臻koshin"]))
        .mockResolvedValueOnce(lyrics([], ["Somebody Else"]))
        .mockResolvedValueOnce(lyrics([], [])),
    };

    const matches = await findCreditMatches(
      provider,
      "composer",
      "胡臻koshin",
      3,
    );

    expect(matches.map(({ id }) => id)).toEqual(["1"]);
    expect(provider.getLyrics).toHaveBeenCalledTimes(3);
  });

  it("keeps only candidates with an exact verified lyricist credit", async () => {
    const provider = {
      searchTracks: vi
        .fn()
        .mockResolvedValue([
          rawTrack("1", "Match"),
          rawTrack("2", "Wrong lyricist"),
        ]),
      getLyrics: vi
        .fn()
        .mockResolvedValueOnce(lyrics(["ＡＬＥＸ， One"], []))
        .mockResolvedValueOnce(lyrics(["Another Writer"], [])),
    };

    const matches = await findCreditMatches(
      provider,
      "lyricist",
      "alex, one",
      2,
    );

    expect(matches.map(({ id }) => id)).toEqual(["1"]);
  });

  it("skips a credit lane when enrichment has no matching credits", () => {
    const seed = buildTasteSeed({
      ...favorite,
      enrichment: {
        ...enrichment,
        credits: { lyricists: [], composers: [], arrangers: [] },
      },
    });

    expect(seed.lyricists).toEqual([]);
    expect(seed.composers).toEqual([]);
  });

  it("requires wiki verification for language and genre matches", async () => {
    const candidates = [
      rawTrack("1", "Japanese"),
      rawTrack("2", "English"),
      rawTrack("3", "Unknown"),
    ];
    const provider = {
      getWikiSummary: vi
        .fn()
        .mockResolvedValueOnce({ ...enrichment, language: "日语" })
        .mockResolvedValueOnce({ ...enrichment, language: "英语" })
        .mockResolvedValueOnce({
          ...enrichment,
          language: null,
          instrumental: false,
        }),
    };

    await expect(
      verifyTagMatches(provider, candidates, "language", "Japanese"),
    ).resolves.toEqual([candidates[0]]);

    const genreProvider = {
      getWikiSummary: vi
        .fn()
        .mockResolvedValueOnce({ ...enrichment, genreTags: ["电子"] })
        .mockResolvedValueOnce({ ...enrichment, genreTags: ["另类/独立"] }),
    };
    await expect(
      verifyTagMatches(
        genreProvider,
        candidates.slice(0, 2),
        "genre",
        "电子",
      ),
    ).resolves.toEqual([candidates[0]]);
  });
});
