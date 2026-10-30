import { describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  ListeningContext,
  RecommendationFeedback,
  TasteProfile,
} from "@resonara/contracts";
import type { AIJsonRequester } from "../services/ai/client";
import type { VerifiedCandidate } from "./verifyPlayable";
import { createRecommendationPlan } from "./aiPlanner";
import { rerankVerifiedCandidates } from "./aiReranker";
import { writeRecommendationExplanations } from "./explanationWriter";

const configuredSettings: AppSettings = {
  musicApiBaseUrl: "https://music.example.test",
  musicApiToken: "",
  aiBaseUrl: "https://api.deepseek.com",
  aiApiKey: "test-key",
  aiModel: "deepseek-flash",
};

const missingKeySettings: AppSettings = {
  ...configuredSettings,
  aiApiKey: "",
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
  topArtists: ["PerVade"],
  energyPreference: 0.6,
  familiarityPreference: 0.5,
  contextAffinities: [],
};

const recentEvents: RecommendationFeedback[] = [];

function verified(
  id: string,
  artist: string,
  sources: VerifiedCandidate["sources"] = ["favorite_similarity"],
): VerifiedCandidate {
  return {
    track: {
      id,
      provider: "netease",
      title: `Track ${id}`,
      artist,
      artistIds: [`artist-${artist}`],
      album: "Album",
      coverUrl: `https://cover.example.test/${id}.jpg`,
      genre: "Electronic",
      energyLabel: "Mid-tempo",
      energy: 0.55,
      durationMs: 180_000,
      playable: true,
    },
    sources,
    seedTrackIds: ["seed-1"],
    matchedDimensions: [],
    rawScore: null,
    playbackUrl: `https://audio.example.test/${id}.mp3`,
    playbackExpiresAt: null,
    verifiedAt: "2026-10-30T15:00:00+08:00",
  };
}

function requesterReturning(value: unknown): AIJsonRequester {
  return vi.fn().mockResolvedValue(value) as unknown as AIJsonRequester;
}

describe("AI recommendation pipeline", () => {
  it("falls back to a deterministic planner without an AI key", async () => {
    const result = await createRecommendationPlan(
      {
        profile,
        favorites: [],
        context,
        intent: "relax",
        recentEvents,
      },
      missingKeySettings,
    );

    expect(result.aiUsed).toBe(false);
    expect(result.plan.searchQueries.length).toBeGreaterThan(0);
    expect(result.plan.targetIntent).toBe("relax");
    expect(result.fallbackReason).toMatch(/key|configured/i);
  });

  it("accepts only verified candidate IDs for AI reranking", async () => {
    const candidates = [
      verified("a", "Artist A"),
      verified("b", "Artist B"),
      verified("c", "Artist C"),
    ];
    const requester = requesterReturning({
      items: [
        { trackId: "b", score: 0.95, reason: "Best context fit." },
        { trackId: "a", score: 0.9, reason: "Closest favorite match." },
        { trackId: "c", score: 0.8, reason: "Adds variety." },
      ],
    });

    const result = await rerankVerifiedCandidates(
      {
        plan: {
          searchQueries: ["warm electronic"],
          artistDirections: [],
          songDirections: [],
          targetEnergy: 0.55,
          targetIntent: "relax",
          rationale: "Warm and relaxed.",
        },
        candidates,
      },
      configuredSettings,
      { requester, persistDecision: vi.fn() },
    );

    expect(result.aiUsed).toBe(true);
    expect(result.items[0]?.trackId).toBe("b");
    expect(result.items).toHaveLength(3);
  });

  it("rejects out-of-pool IDs and falls back to local scoring", async () => {
    const result = await rerankVerifiedCandidates(
      {
        plan: {
          searchQueries: ["warm electronic"],
          artistDirections: [],
          songDirections: [],
          targetEnergy: 0.55,
          targetIntent: "relax",
          rationale: "Warm and relaxed.",
        },
        candidates: [verified("a", "Artist A")],
      },
      configuredSettings,
      {
        requester: requesterReturning({
          items: [
            {
              trackId: "invented",
              score: 1,
              reason: "Not in the pool.",
            },
          ],
        }),
        persistDecision: vi.fn(),
      },
    );

    expect(result.aiUsed).toBe(false);
    expect(result.items.map(({ trackId }) => trackId)).toEqual(["a"]);
    expect(result.fallbackReason).toMatch(/candidate|format|reject/i);
  });

  it("excludes unplayable candidates and diversifies duplicate artists", async () => {
    const unplayable = {
      ...verified("unplayable", "Artist X"),
      track: { ...verified("unplayable", "Artist X").track, playable: false },
    } as VerifiedCandidate;
    const candidates = [
      verified("a1", "Artist A"),
      verified("a2", "Artist A"),
      verified("b1", "Artist B"),
      verified("b2", "Artist B"),
      verified("c1", "Artist C"),
      unplayable,
    ];

    const result = await rerankVerifiedCandidates(
      {
        plan: {
          searchQueries: ["test"],
          artistDirections: [],
          songDirections: [],
          targetEnergy: 0.55,
          targetIntent: "relax",
          rationale: "Test.",
        },
        candidates,
        limit: 3,
      },
      missingKeySettings,
      { persistDecision: vi.fn() },
    );

    expect(result.items.map(({ trackId }) => trackId)).not.toContain(
      "unplayable",
    );
    expect(new Set(result.items.map(({ artist }) => artist)).size).toBe(3);
  });

  it("falls back after AI timeout or malformed JSON", async () => {
    const requester = vi
      .fn()
      .mockRejectedValue(new Error("Aborted")) as unknown as AIJsonRequester;

    const result = await rerankVerifiedCandidates(
      {
        plan: {
          searchQueries: ["test"],
          artistDirections: [],
          songDirections: [],
          targetEnergy: 0.5,
          targetIntent: "focus",
          rationale: "Test.",
        },
        candidates: [verified("a", "Artist A"), verified("b", "Artist B")],
      },
      configuredSettings,
      { requester, persistDecision: vi.fn() },
    );

    expect(result.aiUsed).toBe(false);
    expect(result.items.length).toBe(2);
    expect(result.fallbackReason).toMatch(/Aborted|fallback/i);
  });

  it("writes English explanations only from verified fields", () => {
    const explanations = writeRecommendationExplanations(
      {
        plan: {
          searchQueries: ["test"],
          artistDirections: [],
          songDirections: [],
          targetEnergy: 0.55,
          targetIntent: "relax",
          rationale: "Cloudy and calm.",
        },
        candidates: [verified("a", "Artist A")],
        context,
      },
    );

    expect(explanations[0]).toMatchObject({
      summary: expect.stringContaining("Track a"),
      personalFactor: expect.stringContaining("Artist A"),
      contextFactor: expect.stringMatching(/cloudy|relax/i),
    });
    expect(explanations[0]?.summary).not.toContain("test-key");
  });
});
