import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, ListeningContext } from "@resonara/contracts";
import { resonaraDb } from "../../db/database";
import {
  getDiscoverEdition,
  saveDiscoverEdition,
} from "../../db/repositories/discover";
import type { VerifiedCandidate } from "../../recommendation/verifyPlayable";
import { generateDailyEdition } from "./generateDailyEdition";

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

function verified(id: string, playable = true): VerifiedCandidate {
  return {
    track: {
      id,
      provider: "netease",
      title: `Track ${id}`,
      artist: `Artist ${id}`,
      artistIds: [`artist-${id}`],
      album: "Album",
      coverUrl: `https://cover.example.test/${id}.jpg`,
      genre: "Electronic",
      energyLabel: "Mid-tempo",
      energy: 0.5,
      durationMs: 180_000,
      playable: true,
    },
    sources: ["recommend_songs"],
    seedTrackIds: [],
    matchedDimensions: [],
    rawScore: null,
    playbackUrl: `https://audio.example.test/${id}.mp3`,
    playbackExpiresAt: null,
    verifiedAt: "2026-10-30T15:00:00+08:00",
  };
}

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
}

describe("daily Discover edition", () => {
  beforeEach(resetDatabase);

  it("builds four unique English cards from playable song covers", async () => {
    const candidates = ["a", "b", "c", "d", "e", "f"].map((id) =>
      verified(id),
    );
    const edition = await generateDailyEdition(
      {
        candidates,
        settings,
        context,
        editionDate: "2026-10-30",
        now: new Date("2026-10-30T15:00:00+08:00"),
      },
      { persist: vi.fn() },
    );

    expect(edition.cards).toHaveLength(4);
    expect(new Set(edition.cards.map(({ trackId }) => trackId)).size).toBe(4);
    expect(edition.timeZone).toBe("Asia/Shanghai");
    for (const card of edition.cards) {
      expect(card.coverUrl).toBe(
        candidates.find(({ track }) => track.id === card.trackId)?.track
          .coverUrl,
      );
      expect(card.title).not.toMatch(/Rainy Day|Summer Heat/);
    }
  });

  it("drops unplayable candidates before selecting cards", async () => {
    const candidates = ["a", "b", "c", "d"].map((id) => verified(id));
    const unplayable = {
      ...verified("unplayable"),
      track: { ...verified("unplayable").track, playable: false },
    } as VerifiedCandidate;

    const edition = await generateDailyEdition(
      {
        candidates: [unplayable, ...candidates],
        settings,
        context,
        editionDate: "2026-10-30",
        now: new Date("2026-10-30T15:00:00+08:00"),
      },
      { persist: vi.fn() },
    );

    expect(edition.cards.map(({ trackId }) => trackId)).not.toContain(
      "unplayable",
    );
  });

  it("uses a verified album label when the provider has no genre tag", async () => {
    const candidates = ["a", "b", "c", "d"].map((id) => {
      const candidate = verified(id);
      return {
        ...candidate,
        track: {
          ...candidate.track,
          genre: "Unknown",
          album: `Album ${id}`,
        },
      };
    });

    const edition = await generateDailyEdition(
      {
        candidates,
        settings,
        context,
        editionDate: "2026-10-30",
        now: new Date("2026-10-30T15:00:00+08:00"),
      },
      { persist: vi.fn() },
    );

    expect(edition.cards.every(({ subtitle }) => !subtitle.includes("Unknown"))).toBe(
      true,
    );
    expect(edition.cards.every(({ subtitle }) => subtitle.includes("Album"))).toBe(
      true,
    );
  });

  it("reuses a stored edition for the same local day and timezone", async () => {
    const candidates = ["a", "b", "c", "d"].map((id) => verified(id));
    const edition = await generateDailyEdition(
      {
        candidates,
        settings,
        context,
        editionDate: "2026-10-30",
        now: new Date("2026-10-30T15:00:00+08:00"),
      },
      { persist: saveDiscoverEdition },
    );

    await expect(
      getDiscoverEdition(
        "2026-10-30",
        "Asia/Shanghai",
        new Date("2026-10-30T20:00:00+08:00"),
      ),
    ).resolves.toEqual(edition);
  });

  it("invalidates the stored edition after the local day rolls over", async () => {
    const candidates = ["a", "b", "c", "d"].map((id) => verified(id));
    const edition = await generateDailyEdition(
      {
        candidates,
        settings,
        context,
        editionDate: "2026-10-30",
        now: new Date("2026-10-30T15:00:00+08:00"),
      },
      { persist: saveDiscoverEdition },
    );

    await expect(
      getDiscoverEdition(
        edition.editionDate,
        "Asia/Shanghai",
        new Date("2026-10-31T15:00:00+08:00"),
      ),
    ).resolves.toBeNull();
  });
});
