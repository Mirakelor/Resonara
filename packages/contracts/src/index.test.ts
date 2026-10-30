import { describe, expect, it } from "vitest";
import {
  appSettingsSchema,
  createAIRerankerResultSchema,
  discoverEditionSchema,
  favoriteRecordSchema,
  feedbackEventSchema,
  recommendationBatchSchema,
  recommendationRequestSchema,
} from "./index";

const context = {
  localTime: "2026-10-30T14:30:00+08:00",
  timeZone: "Asia/Shanghai",
  city: "Shanghai",
  weatherSource: "device" as const,
  weather: {
    temperatureC: 28,
    apparentTemperatureC: 31,
    relativeHumidity: 75,
    condition: "cloudy" as const,
    isDay: true,
    observedAt: "2026-10-30T14:00:00+08:00",
  },
};

const track = {
  id: "1959438783",
  provider: "netease" as const,
  title: "Tremolo",
  artist: "Chilli Beans.",
  album: "Chilli Beans.",
  coverUrl:
    "https://p4.music.126.net/L8f07BDPoT_tAHqmTUgP5A==/109951167596576841.jpg",
  genre: "Alternative",
  energyLabel: "Melodic",
  energy: 0.64,
  durationMs: 213000,
  playable: true,
};

describe("recommendation contract", () => {
  it("defaults to using the current environment", () => {
    const request = recommendationRequestSchema.parse({
      sessionId: "07ce4f35-54f4-4b69-80e7-f41f8132f6c8",
      intent: "relax",
      context,
    });

    expect(request.environmentMode).toBe("use_current");
    expect(request.limit).toBe(3);
    expect(request.excludedTrackIds).toEqual([]);
  });

  it("requires exactly four daily discover cards", () => {
    const card = {
      id: "75eb915a-a0db-40ab-810c-4386b7608eb5",
      trackId: track.id,
      coverUrl: track.coverUrl,
      title: "After the Rain, Softly",
      subtitle: "Rain · humid air · low light",
      presetIntent: "relax" as const,
      contextLabel: "Rainy afternoon",
    };

    expect(() =>
      discoverEditionSchema.parse({
        editionDate: "2026-10-30",
        generatedAt: "2026-10-30T00:00:00+08:00",
        expiresAt: "2026-10-31T00:00:00+08:00",
        cards: [card, card, card],
      }),
    ).toThrow();
  });

  it("requires featuredTrackId to match a returned recommendation", () => {
    const item = {
      rank: 1,
      track,
      reason: {
        summary: "A real, playable track.",
        personalFactor: "You saved music in this style.",
        contextFactor: "It suits the current mood.",
      },
      confidence: 0.9,
    };

    expect(() =>
      recommendationBatchSchema.parse({
        id: "75eb915a-a0db-40ab-810c-4386b7608eb5",
        generatedAt: "2026-10-30T14:30:00+08:00",
        intent: "relax",
        environmentMode: "use_current",
        context,
        items: [item],
        featuredTrackId: "not-in-the-batch",
      }),
    ).toThrow();
  });
});

describe("local app contracts", () => {
  it("accepts only http and https music URLs", () => {
    const settings = {
      musicApiBaseUrl: "ftp://music.example.test",
      musicApiToken: "",
      aiBaseUrl: "",
      aiApiKey: "",
      aiModel: "",
    };

    expect(() => appSettingsSchema.parse(settings)).toThrow();
    expect(
      appSettingsSchema.parse({
        ...settings,
        musicApiBaseUrl: "https://music.example.test",
      }).musicApiBaseUrl,
    ).toBe("https://music.example.test");
  });

  it("allows a favorite snapshot without optional enrichment", () => {
    const favorite = {
      trackId: "track-1",
      track,
      createdAt: "2026-10-30T14:30:00+08:00",
      updatedAt: "2026-10-30T14:30:00+08:00",
      lastVerifiedAt: "2026-10-30T14:30:00+08:00",
    };

    expect(favoriteRecordSchema.parse(favorite).enrichment).toBeUndefined();
  });

  it("rejects AI reranker output containing an unknown track ID", () => {
    const schema = createAIRerankerResultSchema(["track-1", "track-2"]);

    expect(() =>
      schema.parse({
        items: [
          {
            trackId: "invented-track",
            score: 0.98,
            reason: "Not a real candidate.",
          },
        ],
      }),
    ).toThrow();
  });

  it("keeps favorite removal events distinct from dislikes", () => {
    expect(feedbackEventSchema.parse("unliked")).toBe("unliked");
    expect(feedbackEventSchema.parse("disliked")).toBe("disliked");
  });
});
