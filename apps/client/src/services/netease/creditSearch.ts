import type { RawTrack } from "./mappers";
import type { ParsedNeteaseLyrics } from "./lyricParser";
import { normalizeCreditName } from "./credits";

type CreditSearchProvider = {
  searchTracks(query: string, limit: number): Promise<RawTrack[]>;
  getLyrics(trackId: string): Promise<ParsedNeteaseLyrics>;
};

export async function findCreditMatches(
  provider: CreditSearchProvider,
  role: "lyricist" | "composer",
  name: string,
  limit: number,
): Promise<RawTrack[]> {
  const expected = normalizeCreditName(name);
  if (!expected) return [];

  const candidates = await provider.searchTracks(name, Math.max(limit, 1));
  const matches: RawTrack[] = [];

  for (const candidate of candidates) {
    if (matches.length >= limit) break;

    let candidateLyrics: ParsedNeteaseLyrics;
    try {
      candidateLyrics = await provider.getLyrics(candidate.id);
    } catch {
      continue;
    }

    const credits =
      role === "lyricist"
        ? candidateLyrics.credits.lyricists
        : candidateLyrics.credits.composers;
    if (
      credits.some((credit) => normalizeCreditName(credit) === expected)
    ) {
      matches.push(candidate);
    }
  }

  return matches;
}
