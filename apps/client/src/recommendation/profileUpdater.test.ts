import { describe, expect, it } from "vitest";
import type {
  ListeningContext,
  TasteProfile,
  Track,
  TrackEnrichment,
} from "@resonara/contracts";
import { applyProfileUpdate } from "./profileUpdater";

const now = new Date("2026-10-30T15:00:00+08:00");

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

const track: Track = {
  id: "track-1",
  provider: "netease",
  title: "Tremolo",
  artist: "Chilli Beans.",
  artistIds: ["artist-1"],
  album: "Album",
  coverUrl: "https://cover.example.test/track.jpg",
  genre: "Electronic",
  energyLabel: "Mid-tempo",
  energy: 0.5,
  durationMs: 180_000,
  playable: true,
};

const enrichment: TrackEnrichment = {
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
};

const profile: TasteProfile = {
  version: 1,
  updatedAt: "2026-09-01T15:00:00+08:00",
  topGenres: [],
  topArtists: [],
  energyPreference: 0.5,
  familiarityPreference: 0.5,
  contextAffinities: [],
  trackAffinities: [],
  artistAffinities: [],
  creditAffinities: [],
  languageAffinities: [],
  genreAffinities: [],
};

describe("profile updater", () => {
  it("gives a favorite strong positive weight across all dimensions", () => {
    const updated = applyProfileUpdate(
      profile,
      {
        event: "liked",
        track,
        enrichment,
      },
      now,
    );

    expect(updated.version).toBe(2);
    expect(updated.trackAffinities?.[0]).toMatchObject({
      key: "track-1",
      weight: 0.8,
    });
    expect(updated.artistAffinities?.[0]?.key).toBe("Chilli Beans.");
    expect(updated.languageAffinities?.[0]?.key).toBe("Japanese");
    expect(updated.genreAffinities?.map(({ key }) => key)).toEqual(
      expect.arrayContaining(["Electronic", "Japanese Pop"]),
    );
    expect(updated.creditAffinities?.map(({ key }) => key)).toEqual(
      expect.arrayContaining(["lyricist:Writer One", "composer:Composer One"]),
    );
  });

  it("does not erase a favorite after one early skip", () => {
    const liked = applyProfileUpdate(
      profile,
      { event: "liked", track, enrichment },
      now,
    );
    const skipped = applyProfileUpdate(
      liked,
      {
        event: "skipped_early",
        track,
        enrichment,
        positionMs: 8_000,
      },
      new Date(now.getTime() + 60_000),
    );

    expect(
      skipped.trackAffinities?.find(({ key }) => key === track.id)?.weight,
    ).toBeGreaterThan(0);
  });

  it("stores context affinities only on batch feedback", () => {
    const updated = applyProfileUpdate(
      profile,
      { event: "batch_fit", track, enrichment, context },
      now,
    );

    expect(updated.contextAffinities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: "weather", value: "cloudy" }),
        expect.objectContaining({ dimension: "humidity", value: "75" }),
        expect.objectContaining({ dimension: "temperature", value: "warm" }),
        expect.objectContaining({ dimension: "time", value: "afternoon" }),
      ]),
    );
    expect(updated.trackAffinities).toEqual([]);
  });

  it("decays older affinities over time", () => {
    const oldProfile: TasteProfile = {
      ...profile,
      artistAffinities: [
        {
          key: "Old Artist",
          weight: 0.8,
          updatedAt: "2026-08-01T15:00:00+08:00",
        },
      ],
    };

    const updated = applyProfileUpdate(
      oldProfile,
      { event: "play_completed", track, enrichment },
      now,
    );
    const old = updated.artistAffinities?.find(
      ({ key }) => key === "Old Artist",
    );

    expect(old?.weight).toBeLessThan(0.8);
    expect(old?.weight).toBeGreaterThan(0);
  });
});
