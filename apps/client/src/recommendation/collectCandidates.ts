import type {
  AIPlannerResult,
  Candidate,
  CandidateSource,
  ListeningContext,
  ListeningIntent,
} from "@resonara/contracts";
import { trackSchema } from "@resonara/contracts";
import type { NeteaseProvider } from "../services/netease/client";
import type { TasteSeed } from "./tasteSeed";
import {
  aiExpansionSources,
  contextSearchSources,
  favoriteSimilarSources,
  publicFallbackSources,
  sameDimensionSources,
} from "./sources/sourceFunctions";
import type {
  MatchedDimension,
  SourcedRawTrack,
} from "./sources/types";

export const CANDIDATE_QUOTAS = {
  favoriteSimilar: 24,
  contextSearch: 20,
  sameDimensions: 20,
  aiExpansion: 16,
} as const;

const RAW_CANDIDATE_CAP = 80;

type CollectCandidatesInput = {
  provider: NeteaseProvider;
  seeds: TasteSeed[];
  planner: AIPlannerResult | null;
  context: ListeningContext;
  intent: ListeningIntent;
  recentFeedback?: unknown[];
};

type MergedSourcedTrack = {
  raw: SourcedRawTrack["raw"];
  sources: CandidateSource[];
  seedTrackIds: string[];
  matchedDimensions: MatchedDimension[];
};

function mergeSourced(tracks: SourcedRawTrack[]): MergedSourcedTrack[] {
  const merged = new Map<string, MergedSourcedTrack>();

  for (const sourced of tracks) {
    const existing = merged.get(sourced.raw.id);
    if (!existing) {
      merged.set(sourced.raw.id, {
        raw: sourced.raw,
        sources: [sourced.source],
        seedTrackIds: sourced.seedTrackId ? [sourced.seedTrackId] : [],
        matchedDimensions: [...sourced.matchedDimensions],
      });
      continue;
    }

    if (!existing.sources.includes(sourced.source)) {
      existing.sources.push(sourced.source);
    }
    if (
      sourced.seedTrackId &&
      !existing.seedTrackIds.includes(sourced.seedTrackId)
    ) {
      existing.seedTrackIds.push(sourced.seedTrackId);
    }
    for (const dimension of sourced.matchedDimensions) {
      if (!existing.matchedDimensions.includes(dimension)) {
        existing.matchedDimensions.push(dimension);
      }
    }
  }

  return [...merged.values()];
}

export async function collectCandidates({
  provider,
  seeds,
  planner,
  context,
  intent,
}: CollectCandidatesInput): Promise<Candidate[]> {
  const primary = await Promise.all([
    favoriteSimilarSources(
      provider,
      seeds,
      CANDIDATE_QUOTAS.favoriteSimilar,
    ),
    contextSearchSources(
      provider,
      planner,
      context,
      intent,
      CANDIDATE_QUOTAS.contextSearch,
    ),
    sameDimensionSources(
      provider,
      seeds,
      CANDIDATE_QUOTAS.sameDimensions,
    ),
    aiExpansionSources(
      provider,
      planner,
      CANDIDATE_QUOTAS.aiExpansion,
    ),
  ]);

  let merged = mergeSourced(primary.flat());
  if (seeds.length === 0 || merged.length < 12) {
    const fallback = await publicFallbackSources(
      provider,
      RAW_CANDIDATE_CAP,
    );
    merged = mergeSourced([
      ...merged.flatMap((candidate) =>
        candidate.sources.map<SourcedRawTrack>((source, index) => ({
          raw: candidate.raw,
          source,
          seedTrackId: candidate.seedTrackIds[0] ?? null,
          matchedDimensions:
            index === 0 ? candidate.matchedDimensions : [],
        })),
      ),
      ...fallback,
    ]);
  }

  merged = merged.slice(0, RAW_CANDIDATE_CAP);
  if (merged.length === 0) return [];

  const details = await provider.getTrackDetails(
    merged.map(({ raw }) => raw.id),
  );
  const detailsById = new Map(details.map((track) => [track.id, track]));

  return merged.flatMap<Candidate>((candidate) => {
    const details = detailsById.get(candidate.raw.id) ?? candidate.raw;
    if (!details.coverUrl) return [];

    return [
      {
        track: trackSchema.parse({
          id: details.id,
          provider: "netease",
          title: details.title,
          artist: details.artist,
          artistIds: details.artistIds,
          album: details.album,
          coverUrl: details.coverUrl,
          genre: "Unknown",
          energyLabel: "Unrated",
          energy: 0.5,
          durationMs: details.durationMs,
          playable: false,
        }),
        sources: candidate.sources,
        seedTrackIds: candidate.seedTrackIds,
        matchedDimensions: candidate.matchedDimensions,
        rawScore: null,
      },
    ];
  });
}
