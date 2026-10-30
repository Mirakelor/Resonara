import {
  createAIRerankerResultSchema,
  type AIPlannerResult,
  type AppSettings,
} from "@resonara/contracts";
import { saveAIDecision } from "../db/repositories/aiDecisions";
import {
  isAIConfigured,
  requestAIJson,
  type AIJsonRequester,
} from "../services/ai/client";
import type { VerifiedCandidate } from "./verifyPlayable";

export type RankedCandidate = {
  trackId: string;
  artist: string;
  score: number;
  reason: string;
  candidate: VerifiedCandidate;
};

type RerankInput = {
  plan: AIPlannerResult;
  candidates: VerifiedCandidate[];
  limit?: number;
  dislikedTrackIds?: ReadonlySet<string>;
  dislikedArtists?: ReadonlySet<string>;
  favoriteArtists?: ReadonlySet<string>;
};

type RerankOptions = {
  requester?: AIJsonRequester;
  persistDecision?: (kind: "reranker", payload: unknown) => Promise<void>;
};

export type RerankOutcome = {
  items: RankedCandidate[];
  aiUsed: boolean;
  fallbackReason: string | null;
};

function localScore(
  candidate: VerifiedCandidate,
  plan: AIPlannerResult,
): number {
  const favoriteSimilarity = candidate.sources.some((source) =>
    ["favorite_similarity", "same_artist", "same_lyricist", "same_composer"].includes(
      source,
    ),
  )
    ? 1
    : 0.2;
  const contextMatch = candidate.sources.includes("ai_context_search")
    ? 1
    : candidate.sources.some((source) =>
          ["same_language", "same_genre"].includes(source),
        )
      ? 0.8
      : 0.4;
  const intentMatch = Math.max(
    0,
    1 - Math.abs(candidate.track.energy - plan.targetEnergy),
  );
  const dimensionMatch = Math.min(
    1,
    candidate.matchedDimensions.length / 3,
  );
  const diversity = 1;
  return (
    favoriteSimilarity * 0.35 +
    contextMatch * 0.2 +
    intentMatch * 0.2 +
    dimensionMatch * 0.15 +
    diversity * 0.1
  );
}

function diversify(
  ranked: RankedCandidate[],
  limit: number,
  favoriteArtists: ReadonlySet<string>,
): RankedCandidate[] {
  const selected: RankedCandidate[] = [];
  const usedArtists = new Set<string>();
  const usedTracks = new Set<string>();

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (usedArtists.has(item.artist)) continue;
    selected.push(item);
    usedArtists.add(item.artist);
    usedTracks.add(item.trackId);
  }

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (usedTracks.has(item.trackId)) continue;
    selected.push(item);
    usedTracks.add(item.trackId);
  }

  if (
    favoriteArtists.size > 0 &&
    selected.length === limit &&
    selected.every(({ artist }) => favoriteArtists.has(artist))
  ) {
    const nonFavorite = ranked.find(({ artist }) => !favoriteArtists.has(artist));
    if (nonFavorite && !usedTracks.has(nonFavorite.trackId)) {
      selected[selected.length - 1] = nonFavorite;
    }
  }

  return selected.slice(0, limit);
}

export async function rerankVerifiedCandidates(
  input: RerankInput,
  settings: AppSettings,
  options: RerankOptions = {},
): Promise<RerankOutcome> {
  const limit = input.limit ?? 3;
  const dislikedTrackIds = input.dislikedTrackIds ?? new Set<string>();
  const dislikedArtists = input.dislikedArtists ?? new Set<string>();
  const favoriteArtists = input.favoriteArtists ?? new Set<string>();
  const candidates = input.candidates.filter(
    (candidate) =>
      candidate.track.playable &&
      !dislikedTrackIds.has(candidate.track.id) &&
      !dislikedArtists.has(candidate.track.artist),
  );
  if (candidates.length === 0) {
    return { items: [], aiUsed: false, fallbackReason: "No eligible candidates." };
  }

  const fallbackItems = diversify(
    candidates
      .map<RankedCandidate>((candidate) => ({
        trackId: candidate.track.id,
        artist: candidate.track.artist,
        score: localScore(candidate, input.plan),
        reason: "Matched verified taste and context signals.",
        candidate,
      }))
      .sort((left, right) => right.score - left.score),
    limit,
    favoriteArtists,
  );

  if (!isAIConfigured(settings)) {
    return {
      items: fallbackItems,
      aiUsed: false,
      fallbackReason: "AI API key or endpoint is not configured.",
    };
  }

  const persist = options.persistDecision ?? saveAIDecision;
  try {
    const schema = createAIRerankerResultSchema(
      candidates.map(({ track }) => track.id),
    );
    const rawResult = await (options.requester ?? requestAIJson)(
      settings,
      {
        purpose: "reranker",
        schema,
        systemPrompt:
          "You rerank verified music candidates. Return JSON only. Use only supplied track IDs and metadata. Never invent tracks or facts. Prefer context and intent fit while preserving artist diversity.",
        userPrompt: JSON.stringify({
          plan: input.plan,
          candidates: candidates.slice(0, 60).map((candidate) => ({
            trackId: candidate.track.id,
            title: candidate.track.title,
            artist: candidate.track.artist,
            genre: candidate.track.genre,
            energy: candidate.track.energy,
            sources: candidate.sources,
            matchedDimensions: candidate.matchedDimensions,
          })),
          dislikedTrackIds: [...dislikedTrackIds],
          dislikedArtists: [...dislikedArtists],
          requiredOutput: {
            items: [
              {
                trackId: "must be one of candidates",
                score: "number from 0 to 1",
                reason: "short English reason grounded in supplied metadata",
              },
            ],
          },
        }),
      },
    );
    const parsedResult = schema.safeParse(rawResult);
    if (!parsedResult.success) {
      throw new Error(
        "AI reranking was rejected because it returned an invalid track ID.",
      );
    }
    const aiResult = parsedResult.data;

    const aiRanked = aiResult.items.flatMap<RankedCandidate>((item) => {
      const candidate = candidates.find(
        ({ track }) => track.id === item.trackId,
      );
      return candidate
        ? [
            {
              trackId: item.trackId,
              artist: candidate.track.artist,
              score: item.score,
              reason: item.reason,
              candidate,
            },
          ]
        : [];
    });
    const localById = new Map(
      fallbackItems.map((item) => [item.trackId, item]),
    );
    const combined = [...aiRanked];
    for (const item of [...fallbackItems, ...localById.values()]) {
      if (!combined.some(({ trackId }) => trackId === item.trackId)) {
        combined.push(item);
      }
    }
    const items = diversify(combined, limit, favoriteArtists);
    await persist("reranker", {
      aiUsed: true,
      selectedTrackIds: items.map(({ trackId }) => trackId),
    });
    return { items, aiUsed: true, fallbackReason: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "AI reranking failed.";
    await persist("reranker", {
      aiUsed: false,
      fallbackReason: reason,
      selectedTrackIds: fallbackItems.map(({ trackId }) => trackId),
    });
    return {
      items: fallbackItems,
      aiUsed: false,
      fallbackReason:
        reason.toLowerCase().includes("validation") ||
        reason.toLowerCase().includes("track id")
          ? "AI reranking was rejected; using local scoring fallback."
          : `${reason}; using local scoring fallback.`,
    };
  }
}
