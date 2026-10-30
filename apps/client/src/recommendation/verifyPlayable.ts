import type {
  Candidate,
  PlaybackResolution,
} from "@resonara/contracts";
import type { NeteaseProvider } from "../services/netease/client";

export type VerifiedCandidate = Candidate & {
  track: Candidate["track"] & { playable: true };
  playbackUrl: string;
  playbackExpiresAt: string | null;
  verifiedAt: string;
};

type VerifyPlayableOptions = {
  now?: () => Date;
  maxResults?: number;
  loadMore?: (excludedTrackIds: ReadonlySet<string>) => Promise<Candidate[]>;
};

const MAX_VERIFIED_CANDIDATES = 40;
const MINIMUM_PLAYABLE = 3;
const MAX_EXTRA_BATCHES = 3;

function isExpired(
  resolution: PlaybackResolution,
  now: Date,
): boolean {
  return Boolean(
    resolution.expiresAt &&
      new Date(resolution.expiresAt).getTime() <= now.getTime(),
  );
}

function hasSupportedMedia(
  url: string,
  mediaType: string | null | undefined,
): boolean {
  if (mediaType) {
    const normalized = mediaType.toLowerCase().split(";", 1)[0]?.trim();
    return Boolean(
      normalized?.startsWith("audio/") ||
        ["mp3", "m4a", "aac", "flac", "ogg", "opus", "wav"].includes(
          normalized ?? "",
        ),
    );
  }

  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }

  const extension = pathname.match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension) return true;
  return ["mp3", "m4a", "aac", "flac", "ogg", "opus", "wav"].includes(
    extension,
  );
}

function usableResolution(
  resolution: PlaybackResolution | undefined,
  now: Date,
): resolution is PlaybackResolution & { url: string } {
  const url = resolution?.url?.trim() ?? "";
  return Boolean(
    resolution &&
      url &&
      resolution.playable &&
      !isExpired(resolution, now) &&
      hasSupportedMedia(url, resolution.mediaType),
  );
}

export async function resolveFreshPlaybackUrl(
  trackId: string,
  provider: NeteaseProvider,
  now = new Date(),
): Promise<{ url: string; expiresAt: string | null } | null> {
  let resolution = (await provider.resolvePlaybackUrls([trackId])).get(
    trackId,
  );

  if (
    resolution &&
    resolution.url &&
    isExpired(resolution, now)
  ) {
    resolution = (await provider.resolvePlaybackUrls([trackId])).get(trackId);
  }

  return usableResolution(resolution, now)
    ? { url: resolution.url, expiresAt: resolution.expiresAt }
    : null;
}

async function resolveCandidates(
  candidates: Candidate[],
  provider: NeteaseProvider,
  now: Date,
): Promise<VerifiedCandidate[]> {
  if (candidates.length === 0) return [];

  const byId = new Map(candidates.map((candidate) => [candidate.track.id, candidate]));
  let resolutions = await provider.resolvePlaybackUrls([...byId.keys()]);

  const initiallyExpired = [...resolutions.values()]
    .filter(
      (resolution) =>
        Boolean(resolution.url) && isExpired(resolution, now),
    )
    .map((resolution) => resolution.trackId);
  if (initiallyExpired.length > 0) {
    const refreshed = await provider.resolvePlaybackUrls(initiallyExpired);
    resolutions = new Map([...resolutions, ...refreshed]);
  }

  const verified: VerifiedCandidate[] = [];
  for (const [trackId, resolution] of resolutions) {
    const candidate = byId.get(trackId);
    const url = resolution.url?.trim() ?? "";
    if (
      !candidate ||
      !url ||
      !resolution.playable ||
      isExpired(resolution, now) ||
      !hasSupportedMedia(url, resolution.mediaType)
    ) {
      continue;
    }

    verified.push({
      ...candidate,
      track: { ...candidate.track, playable: true },
      playbackUrl: url,
      playbackExpiresAt: resolution.expiresAt,
      verifiedAt: now.toISOString(),
    });
  }

  return verified;
}

export async function verifyPlayableCandidates(
  candidates: Candidate[],
  provider: NeteaseProvider,
  options: VerifyPlayableOptions = {},
): Promise<VerifiedCandidate[]> {
  const now = options.now?.() ?? new Date();
  const maxResults = options.maxResults ?? MAX_VERIFIED_CANDIDATES;
  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((candidate) => {
    if (seen.has(candidate.track.id)) return false;
    seen.add(candidate.track.id);
    return true;
  });

  let pending = uniqueCandidates;
  let verified: VerifiedCandidate[] = [];
  let extraBatches = 0;

  while (pending.length > 0) {
    verified = [
      ...verified,
      ...(await resolveCandidates(pending, provider, now)),
    ].slice(0, maxResults);

    if (
      verified.length >= MINIMUM_PLAYABLE ||
      !options.loadMore ||
      extraBatches >= MAX_EXTRA_BATCHES
    ) {
      break;
    }

    extraBatches += 1;
    const excluded = new Set([...seen, ...verified.map(({ track }) => track.id)]);
    const more = await options.loadMore(excluded);
    pending = more.filter((candidate) => {
      if (seen.has(candidate.track.id)) return false;
      seen.add(candidate.track.id);
      return true;
    });
  }

  return verified.slice(0, maxResults);
}

export async function revalidateVerifiedCandidates(
  candidates: VerifiedCandidate[],
  provider: NeteaseProvider,
  options: Pick<VerifyPlayableOptions, "now" | "maxResults"> = {},
): Promise<VerifiedCandidate[]> {
  return verifyPlayableCandidates(
    candidates.map(({ track, sources, seedTrackIds, matchedDimensions, rawScore }) => ({
      track,
      sources,
      seedTrackIds,
      matchedDimensions,
      rawScore,
    })),
    provider,
    options,
  );
}
