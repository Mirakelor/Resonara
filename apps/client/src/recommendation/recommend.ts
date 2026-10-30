import {
  recommendationBatchSchema,
  type AppSettings,
  type Candidate,
  type EnvironmentMode,
  type FavoriteRecord,
  type ListeningContext,
  type ListeningIntent,
  type RecommendationBatch,
  type RecommendationFeedback,
  type TasteProfile,
} from "@resonara/contracts";
import { saveRecommendationBatch } from "../db/repositories/recommendations";
import type { NeteaseProvider } from "../services/netease/client";
import type { RawTrack } from "../services/netease/mappers";
import { createRecommendationPlan } from "./aiPlanner";
import { rerankVerifiedCandidates, type RankedCandidate } from "./aiReranker";
import { collectCandidates } from "./collectCandidates";
import { writeRecommendationExplanations } from "./explanationWriter";
import { buildTasteSeed } from "./tasteSeed";
import {
  verifyPlayableCandidates,
  type VerifiedCandidate,
} from "./verifyPlayable";

type GenerateInput = {
  settings: AppSettings;
  profile: TasteProfile;
  favorites: FavoriteRecord[];
  context: ListeningContext;
  environmentMode: EnvironmentMode;
  intent: ListeningIntent;
  recentEvents: RecommendationFeedback[];
  seedTrackId?: string;
};

type GenerateOptions = {
  provider: NeteaseProvider;
  persist?: (batch: RecommendationBatch) => Promise<void>;
  now?: () => Date;
  random?: () => number;
};

function trackFromRaw(raw: RawTrack, playable: boolean) {
  if (!raw.coverUrl) return null;
  return {
    id: raw.id,
    provider: "netease" as const,
    title: raw.title,
    artist: raw.artist,
    artistIds: raw.artistIds,
    album: raw.album,
    coverUrl: raw.coverUrl,
    genre: "Unknown",
    energyLabel: "Unrated",
    energy: 0.5,
    durationMs: raw.durationMs,
    playable,
  };
}

function energyFromBpm(bpm: number | null, fallback: number): number {
  if (!bpm) return fallback;
  return Math.max(0.1, Math.min(0.95, (bpm - 50) / 110));
}

function energyLabel(
  bpm: number | null,
  recommendationTags: string[],
  energy: number,
): string {
  if (recommendationTags[0]) return recommendationTags[0];
  if (bpm) {
    if (bpm < 90) return "Calm";
    if (bpm < 120) return "Mid-tempo";
    return "Driving";
  }
  if (energy < 0.4) return "Calm";
  if (energy < 0.7) return "Mid-tempo";
  return "Driving";
}

async function hydrateSelectedMetadata(
  items: RankedCandidate[],
  provider: NeteaseProvider,
): Promise<RankedCandidate[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const enrichment = await provider.getWikiSummary(item.trackId);
        const nextEnergy = energyFromBpm(
          enrichment.bpm,
          item.candidate.track.energy,
        );
        return {
          ...item,
          candidate: {
            ...item.candidate,
            track: {
              ...item.candidate.track,
              genre: enrichment.genreTags[0] ?? item.candidate.track.genre,
              energy: nextEnergy,
              energyLabel: energyLabel(
                enrichment.bpm,
                enrichment.recommendationTags,
                nextEnergy,
              ),
            },
          },
        };
      } catch {
        const nextEnergy = item.candidate.track.energy;
        return {
          ...item,
          candidate: {
            ...item.candidate,
            track: {
              ...item.candidate.track,
              energyLabel:
                item.candidate.track.energyLabel === "Unrated"
                  ? energyLabel(null, [], nextEnergy)
                  : item.candidate.track.energyLabel,
            },
          },
        };
      }
    }),
  );
}

async function loadSeedCandidate(
  seedTrackId: string,
  provider: NeteaseProvider,
): Promise<Candidate | null> {
  const details = await provider.getTrackDetails([seedTrackId]);
  const raw = details.find(({ id }) => id === seedTrackId);
  if (!raw) return null;
  const track = trackFromRaw(raw, false);
  if (!track) return null;
  return {
    track,
    sources: ["discover_seed"],
    seedTrackIds: [seedTrackId],
    matchedDimensions: [],
    rawScore: null,
  };
}

async function loadFallbackCandidates(
  provider: NeteaseProvider,
  excludedTrackIds: ReadonlySet<string>,
): Promise<Candidate[]> {
  const [recommended, newSongs] = await Promise.all([
    provider.getPublicRecommendations().catch(() => []),
    provider.getNewSongs(20).catch(() => []),
  ]);
  const raws = [...recommended, ...newSongs].filter(
    ({ id }) => !excludedTrackIds.has(id),
  );
  const ids = [...new Set(raws.map(({ id }) => id))];
  const details = await provider.getTrackDetails(ids).catch(() => []);
  return details.flatMap<Candidate>((raw) => {
    const track = trackFromRaw(raw, false);
    return track
      ? [
          {
            track,
            sources: ["recommend_songs"],
            seedTrackIds: [],
            matchedDimensions: [],
            rawScore: null,
          },
        ]
      : [];
  });
}

function ensureSeedSelection(
  items: RankedCandidate[],
  verified: VerifiedCandidate[],
  seedTrackId: string | undefined,
): RankedCandidate[] {
  if (!seedTrackId || items.some(({ trackId }) => trackId === seedTrackId)) {
    return items;
  }
  const seed = verified.find(({ track }) => track.id === seedTrackId);
  if (!seed) return items;
  const rankedSeed: RankedCandidate = {
    trackId: seed.track.id,
    artist: seed.track.artist,
    score: 0.75,
    reason: "Selected from today's Discover edition.",
    candidate: seed,
  };
  return [rankedSeed, ...items.filter(({ trackId }) => trackId !== seedTrackId)].slice(
    0,
    3,
  );
}

export async function generateRecommendationBatch(
  input: GenerateInput,
  options: GenerateOptions,
): Promise<RecommendationBatch> {
  const now = options.now?.() ?? new Date();
  const sortedFavorites = [...input.favorites].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const planner = await createRecommendationPlan(
    {
      profile: input.profile,
      favorites: sortedFavorites,
      context: input.context,
      intent: input.intent,
      recentEvents: input.recentEvents,
    },
    input.settings,
  );
  const seeds = sortedFavorites.map(buildTasteSeed);

  let candidates = await collectCandidates({
    provider: options.provider,
    seeds,
    planner: planner.plan,
    context: input.context,
    intent: input.intent,
    recentFeedback: input.recentEvents,
  });

  if (input.seedTrackId) {
    const existing = candidates.some(
      ({ track }) => track.id === input.seedTrackId,
    );
    if (!existing) {
      const seedCandidate = await loadSeedCandidate(
        input.seedTrackId,
        options.provider,
      );
      if (seedCandidate) candidates = [seedCandidate, ...candidates];
    }
  }

  let verified = await verifyPlayableCandidates(candidates, options.provider, {
    now: () => now,
    maxResults: 40,
    loadMore: (excluded) =>
      loadFallbackCandidates(options.provider, excluded),
  });
  if (verified.length < 3) {
    const extras = await loadFallbackCandidates(
      options.provider,
      new Set(verified.map(({ track }) => track.id)),
    );
    verified = await verifyPlayableCandidates(
      [...candidates, ...extras],
      options.provider,
      { now: () => now, maxResults: 40 },
    );
  }
  if (verified.length < 3) {
    throw new Error("Fewer than three anonymous playable tracks are available.");
  }

  const dislikedEvents = input.recentEvents.filter(
    ({ event }) => event === "disliked",
  );
  const reranked = await rerankVerifiedCandidates(
    {
      plan: planner.plan,
      candidates: verified,
      limit: 3,
      dislikedTrackIds: new Set(
        dislikedEvents.flatMap(({ trackId }) => (trackId ? [trackId] : [])),
      ),
      favoriteArtists: new Set(
        sortedFavorites.map(({ track }) => track.artist),
      ),
    },
    input.settings,
  );
  const selectedWithSeed = ensureSeedSelection(
    reranked.items,
    verified,
    input.seedTrackId,
  );
  if (selectedWithSeed.length !== 3) {
    throw new Error("Exactly three playable recommendations could not be assembled.");
  }
  const selected = await hydrateSelectedMetadata(
    selectedWithSeed,
    options.provider,
  );

  const explanationCandidates = selected.map(({ candidate }) => candidate);
  const explanations = writeRecommendationExplanations({
    plan: planner.plan,
    candidates: explanationCandidates,
    context: input.context,
  });
  const featuredIndex = Math.min(
    selected.length - 1,
    Math.floor((options.random ?? Math.random)() * selected.length),
  );
  const batch = recommendationBatchSchema.parse({
    id: crypto.randomUUID(),
    generatedAt: now.toISOString(),
    intent: input.intent,
    environmentMode: input.environmentMode,
    context: input.context,
    items: selected.map((item, index) => ({
      rank: index + 1,
      track: item.candidate.track,
      reason: explanations[index]!,
      confidence: item.score,
      sources: item.candidate.sources,
      seedTrackId: item.candidate.seedTrackIds[0],
    })),
    featuredTrackId: selected[featuredIndex]?.trackId ?? selected[0]!.trackId,
  });

  await (options.persist ?? saveRecommendationBatch)(batch);
  return batch;
}

export async function isRecommendationBatchPlayable(
  batch: RecommendationBatch,
  provider: NeteaseProvider,
  now = new Date(),
): Promise<boolean> {
  const candidates: Candidate[] = batch.items.map((item) => ({
    track: item.track,
    sources:
      item.sources ??
      (item.source ? [item.source] : ["recommend_songs"]),
    seedTrackIds: item.seedTrackId ? [item.seedTrackId] : [],
    matchedDimensions: [],
    rawScore: null,
  }));
  const fresh = await verifyPlayableCandidates(candidates, provider, {
    now: () => now,
    maxResults: batch.items.length,
  });
  return fresh.length === batch.items.length;
}
