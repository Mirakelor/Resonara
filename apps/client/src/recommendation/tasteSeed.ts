import type {
  FavoriteRecord,
  TrackEnrichment,
} from "@resonara/contracts";
import type { RawTrack } from "../services/netease/mappers";
import { normalizeCreditName } from "../services/netease/credits";

export { findCreditMatches } from "../services/netease/creditSearch";

export type TasteSeed = {
  favoriteTrackId: string;
  artistIds: string[];
  lyricists: string[];
  composers: string[];
  language: string | null;
  genreTags: string[];
};

const LANGUAGE_MAP: Record<string, string> = {
  日语: "Japanese",
  日語: "Japanese",
  japanese: "Japanese",
  ja: "Japanese",
  英语: "English",
  英語: "English",
  english: "English",
  en: "English",
  华语: "Chinese",
  華語: "Chinese",
  国语: "Chinese",
  國語: "Chinese",
  chinese: "Chinese",
  zh: "Chinese",
  韩语: "Korean",
  韓語: "Korean",
  korean: "Korean",
  ko: "Korean",
};

export function normalizeLanguageTag(tag: string | null): string | null {
  if (!tag) return null;
  const normalized = tag.normalize("NFKC").trim();
  if (normalized === "纯音乐" || normalized === "純音樂") return null;
  return LANGUAGE_MAP[normalized.toLocaleLowerCase("en")] ?? normalized;
}

function normalizeComparable(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en");
}

export function buildTasteSeed(favorite: FavoriteRecord): TasteSeed {
  const enrichment = favorite.enrichment;

  return {
    favoriteTrackId: favorite.trackId,
    artistIds: [...(favorite.track.artistIds ?? [])],
    lyricists: [...(enrichment?.credits.lyricists ?? [])],
    composers: [...(enrichment?.credits.composers ?? [])],
    language: normalizeLanguageTag(enrichment?.language ?? null),
    genreTags: [...(enrichment?.genreTags ?? [])],
  };
}

type TagVerificationProvider = {
  getWikiSummary(trackId: string): Promise<TrackEnrichment>;
};

export async function verifyTagMatches(
  provider: TagVerificationProvider,
  candidates: RawTrack[],
  dimension: "language" | "genre",
  expectedValue: string,
): Promise<RawTrack[]> {
  const expected =
    dimension === "language"
      ? normalizeLanguageTag(expectedValue)
      : expectedValue.normalize("NFKC").trim();
  if (!expected) return [];

  const verified: RawTrack[] = [];
  for (const candidate of candidates) {
    let enrichment: TrackEnrichment;
    try {
      enrichment = await provider.getWikiSummary(candidate.id);
    } catch {
      continue;
    }

    if (dimension === "language") {
      const actual = normalizeLanguageTag(enrichment.language);
      if (actual && actual === expected) verified.push(candidate);
    } else {
      const normalizedExpected = normalizeComparable(expected);
      if (
        enrichment.genreTags.some(
          (genre) => normalizeComparable(genre) === normalizedExpected,
        )
      ) {
        verified.push(candidate);
      }
    }
  }

  return verified;
}

export function hasCreditLane(seed: TasteSeed, role: "lyricist" | "composer") {
  const values =
    role === "lyricist" ? seed.lyricists : seed.composers;
  return values.some((value) => Boolean(normalizeCreditName(value)));
}
