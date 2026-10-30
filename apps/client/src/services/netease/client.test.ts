import { afterEach, describe, expect, it, vi } from "vitest";
import artistSongsFixture from "../../../../../tests/fixtures/netease/artist-songs.json";
import detailsFixture from "../../../../../tests/fixtures/netease/details.json";
import lyricsChineseFixture from "../../../../../tests/fixtures/netease/lyrics-chinese-credits.json";
import lyricsEnglishFixture from "../../../../../tests/fixtures/netease/lyrics-english-credits.json";
import lyricsInstrumentalFixture from "../../../../../tests/fixtures/netease/lyrics-instrumental.json";
import newsongFixture from "../../../../../tests/fixtures/netease/newsong.json";
import playbackFixture from "../../../../../tests/fixtures/netease/playback-mixed.json";
import recommendationsFixture from "../../../../../tests/fixtures/netease/recommendations.json";
import searchFixture from "../../../../../tests/fixtures/netease/search.json";
import similarFixture from "../../../../../tests/fixtures/netease/similar.json";
import wikiEnglishFixture from "../../../../../tests/fixtures/netease/wiki-english.json";
import wikiInstrumentalFixture from "../../../../../tests/fixtures/netease/wiki-instrumental.json";
import wikiJapaneseFixture from "../../../../../tests/fixtures/netease/wiki-japanese.json";
import { normalizeCreditName } from "./credits";
import { createNeteaseProvider } from "./client";

const settings = {
  musicApiBaseUrl: "https://music.example.test",
  musicApiToken: "",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: "",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function useResponses(...bodies: unknown[]) {
  const fetchMock = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(jsonResponse(bodies.shift())),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anonymous Netease adapter", () => {
  it("searches and maps five raw tracks with artist IDs", async () => {
    const fetchMock = useResponses(searchFixture);
    const provider = createNeteaseProvider(settings);

    const tracks = await provider.searchTracks("Tremolo Chilli Beans", 5);

    expect(tracks).toHaveLength(5);
    expect(tracks[0]).toMatchObject({
      id: "1959438783",
      title: "Tremolo",
      artist: "Chilli Beans.",
      artistIds: ["49392892"],
      album: "Chilli Beans.",
      durationMs: 187977,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/search?keywords=Tremolo+Chilli+Beans&limit=5",
    );
    expect(
      new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.has(
        "_resonara_ts",
      ),
    ).toBe(true);
  });

  it("loads track details with artist IDs and cover URLs", async () => {
    useResponses(detailsFixture);
    const provider = createNeteaseProvider(settings);

    const details = await provider.getTrackDetails([
      "1959438783",
      "3451233414",
    ]);

    expect(details[0]).toMatchObject({
      id: "1959438783",
      title: "Tremolo",
      artistIds: ["49392892"],
      coverUrl:
        "https://p3.music.126.net/L8f07BDPoT_tAHqmTUgP5A==/109951167596576841.jpg",
    });
  });

  it("maps Japanese, English, and instrumental wiki summaries", async () => {
    useResponses(wikiJapaneseFixture, wikiEnglishFixture, wikiInstrumentalFixture);
    const provider = createNeteaseProvider(settings);

    await expect(provider.getWikiSummary("1")).resolves.toMatchObject({
      genreTags: ["流行-日本流行"],
      recommendationTags: ["活力"],
      language: "日语",
      instrumental: false,
      bpm: null,
    });
    await expect(provider.getWikiSummary("2")).resolves.toMatchObject({
      genreTags: ["另类/独立"],
      language: "英语",
      instrumental: false,
    });
    await expect(provider.getWikiSummary("3")).resolves.toMatchObject({
      genreTags: ["电子"],
      language: null,
      instrumental: true,
      bpm: 89,
    });
  });

  it("extracts Chinese and English lyric credits without guessing", async () => {
    useResponses(lyricsChineseFixture, lyricsEnglishFixture);
    const provider = createNeteaseProvider(settings);

    const chinese = await provider.getLyrics("1");
    expect(chinese.hasLyrics).toBe(true);
    expect(chinese.originalLrc).toContain("[00:03.58]第一行");
    expect(chinese.translationLrc).toContain("Translation one");
    expect(chinese.offsetMs).toBe(80);
    expect(chinese.credits).toEqual({
      lyricists: ["大九_LN", "人锦Renjin"],
      composers: ["胡臻koshin", "人锦Renjin"],
      arrangers: [],
    });

    const english = await provider.getLyrics("2");
    expect(english.credits).toEqual({
      lyricists: ["Alex", "One"],
      composers: ["Jamie", "Casey"],
      arrangers: ["Robin"],
    });
  });

  it("treats pure-music lyrics as unavailable", async () => {
    useResponses(lyricsInstrumentalFixture);
    const provider = createNeteaseProvider(settings);

    await expect(provider.getLyrics("3")).resolves.toMatchObject({
      hasLyrics: false,
      originalLrc: null,
      credits: { lyricists: [], composers: [], arrangers: [] },
    });
  });

  it("normalizes credit punctuation and Latin case", () => {
    expect(normalizeCreditName("  ＡＬＥＸ，  One ")).toBe("alex, one");
    expect(normalizeCreditName("Alex 、One")).toBe("alex, one");
  });

  it("loads similar, artist, public, and new-song sources", async () => {
    const fetchMock = useResponses(
      similarFixture,
      artistSongsFixture,
      recommendationsFixture,
      newsongFixture,
    );
    const provider = createNeteaseProvider(settings);

    await expect(provider.getSimilarSongs("1959438783", 2)).resolves.toHaveLength(
      2,
    );
    await expect(provider.getArtistSongs("49392892", 2)).resolves.toHaveLength(
      2,
    );
    await expect(provider.getPublicRecommendations()).resolves.toHaveLength(1);
    await expect(provider.getNewSongs(1)).resolves.toHaveLength(1);
    expect(
      fetchMock.mock.calls.map(([url]) => {
        const parsed = new URL(String(url));
        parsed.searchParams.delete("_resonara_ts");
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
      }),
    ).toEqual([
      "https://music.example.test/simi/song?id=1959438783&limit=2",
      "https://music.example.test/artist/songs?id=49392892&limit=2",
      "https://music.example.test/recommend/songs",
      "https://music.example.test/personalized/newsong?limit=1",
    ]);
  });

  it("marks only non-empty playback URLs as playable", async () => {
    useResponses(playbackFixture);
    const provider = createNeteaseProvider(settings);

    const playback = await provider.resolvePlaybackUrls(["1", "2", "3", "4"]);

    expect(playback.get("1")).toMatchObject({
      url: "https://audio.example.test/one.mp3",
      playable: true,
      level: "standard",
    });
    expect(playback.get("2")).toMatchObject({ url: null, playable: false });
    expect(playback.get("3")).toMatchObject({ url: null, playable: false });
    expect(playback.get("4")).toMatchObject({ playable: true });
  });

  it("batches playback validation in groups of at most twenty", async () => {
    const first = {
      code: 200,
      data: Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        url: `https://audio.example.test/${index + 1}.mp3`,
        expi: 1200,
        type: "mp3",
      })),
    };
    const second = {
      code: 200,
      data: Array.from({ length: 5 }, (_, index) => ({
        id: index + 21,
        url: `https://audio.example.test/${index + 21}.mp3`,
        expi: 1200,
        type: "mp3",
      })),
    };
    const fetchMock = useResponses(first, second);
    const provider = createNeteaseProvider(settings);
    const ids = Array.from({ length: 25 }, (_, index) => String(index + 1));

    await expect(provider.resolvePlaybackUrls(ids)).resolves.toHaveLength(25);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `id=${ids.slice(0, 20).join("%2C")}`,
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "id=21%2C22%2C23%2C24%2C25",
    );
  });
});
