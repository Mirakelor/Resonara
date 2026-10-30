import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MUSIC_API_BASE_URL,
  clearAllData,
  resonaraDb,
} from "./database";
import { getSettings, saveSettings } from "./repositories/settings";
import { addFavorite, getFavoritesByArtist, getFavoritesByCredit } from "./repositories/favorites";
import { getLyricsCache, setLyricsCache } from "./repositories/cache";
import { getPlaybackCache, setPlaybackCache } from "./repositories/cache";

const timestamp = "2026-10-30T14:30:00+08:00";

const favoriteTrack = {
  id: "track-1",
  provider: "netease" as const,
  title: "Tremolo",
  artist: "Chilli Beans.",
  artistIds: ["49392892"],
  album: "Chilli Beans.",
  coverUrl:
    "https://p4.music.126.net/L8f07BDPoT_tAHqmTUgP5A==/109951167596576841.jpg",
  genre: "Alternative",
  energyLabel: "Melodic",
  energy: 0.64,
  durationMs: 213000,
  playable: true,
};

const favorite = {
  trackId: favoriteTrack.id,
  track: favoriteTrack,
  enrichment: {
    credits: {
      lyricists: ["Writer One"],
      composers: ["Composer One"],
      arrangers: [],
    },
    genreTags: ["Japanese Pop"],
    recommendationTags: ["Melodic"],
    language: "Japanese",
    instrumental: false,
    bpm: null,
  },
  createdAt: timestamp,
  updatedAt: timestamp,
  lastVerifiedAt: timestamp,
};

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
}

describe("local database", () => {
  beforeEach(resetDatabase);
  afterEach(() => resonaraDb.close());

  it("uses the supplied Music API URL on first launch", async () => {
    const settings = await getSettings();

    expect(settings.musicApiBaseUrl).toBe(DEFAULT_MUSIC_API_BASE_URL);
    expect(settings.aiApiKey).toBe("");
  });

  it("retains saved settings after a database close and reopen", async () => {
    await saveSettings({
      musicApiBaseUrl: "https://music.example.test/",
      musicApiToken: "music-token",
      aiBaseUrl: "https://ai.example.test/v1",
      aiApiKey: "ai-key",
      aiModel: "model-name",
    });

    resonaraDb.close();
    await resonaraDb.open();

    await expect(getSettings()).resolves.toEqual({
      musicApiBaseUrl: "https://music.example.test",
      musicApiToken: "music-token",
      aiBaseUrl: "https://ai.example.test/v1",
      aiApiKey: "ai-key",
      aiModel: "model-name",
    });
  });

  it("returns favorites through artist and credit indexes", async () => {
    await addFavorite(favorite);

    await expect(getFavoritesByArtist("Chilli Beans.")).resolves.toEqual([
      favorite,
    ]);
    await expect(getFavoritesByCredit("lyricist", "Writer One")).resolves.toEqual([
      favorite,
    ]);
    await expect(getFavoritesByCredit("composer", "Composer One")).resolves.toEqual([
      favorite,
    ]);
  });

  it("deletes expired lyrics and playback cache entries when read", async () => {
    await setLyricsCache("track-1", { originalLrc: "[00:00.00]Lyrics" }, "2026-10-30T14:00:00+08:00");
    await setPlaybackCache("track-1", { url: "https://audio.example.test/song.mp3" }, "2026-10-30T14:00:00+08:00");

    const now = new Date("2026-10-30T15:00:00+08:00");
    await expect(getLyricsCache("track-1", now)).resolves.toBeNull();
    await expect(getPlaybackCache("track-1", now)).resolves.toBeNull();
    await expect(resonaraDb.lyricsCache.count()).resolves.toBe(0);
    await expect(resonaraDb.playbackCache.count()).resolves.toBe(0);
  });

  it("clears every table and restores default settings", async () => {
    await addFavorite(favorite);
    await saveSettings({
      musicApiBaseUrl: "https://custom.example.test",
      musicApiToken: "token",
      aiBaseUrl: "https://ai.example.test",
      aiApiKey: "key",
      aiModel: "model",
    });

    await clearAllData();

    await expect(resonaraDb.favorites.count()).resolves.toBe(0);
    await expect(getSettings()).resolves.toMatchObject({
      musicApiBaseUrl: DEFAULT_MUSIC_API_BASE_URL,
      musicApiToken: "",
      aiBaseUrl: "",
      aiApiKey: "",
      aiModel: "",
    });
  });
});
