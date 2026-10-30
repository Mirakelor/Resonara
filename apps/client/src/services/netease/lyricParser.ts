import type {
  LyricsResponse,
  TrackCredits,
} from "@resonara/contracts";
import {
  applyCreditLine,
  EMPTY_CREDITS,
} from "./credits";

type LyricPayload = {
  lrc?: { lyric?: string | null } | null;
  tlyric?: { lyric?: string | null } | null;
  yrc?: { lyric?: string | null } | null;
  ytlrc?: { lyric?: string | null } | null;
  offset?: number;
};

export type ParsedNeteaseLyrics = LyricsResponse & {
  credits: TrackCredits;
};

function linesFromRichText(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (!line.startsWith("{")) return [line];

      try {
        const parsed = JSON.parse(line) as {
          c?: Array<{ tx?: unknown }>;
        };
        const text = parsed.c
          ?.map((part) => (typeof part.tx === "string" ? part.tx : ""))
          .join("")
          .trim();
        return text ? [text] : [];
      } catch {
        return [];
      }
    });
}

function containsRealLyrics(lrc: string | null): boolean {
  if (!lrc) return false;
  const timedText = lrc
    .split(/\r?\n/)
    .filter((line) => /^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?]/.test(line.trim()))
    .map((line) => line.replace(/^\[[^\]]+]\s*/, "").trim())
    .filter(Boolean)
    .join(" ");

  if (!timedText) return false;
  if (/^(?:纯音乐|純音樂|instrumental)[，,。.\s]*(?:请欣赏|請欣賞)?[。.\s]*$/iu.test(timedText)) {
    return false;
  }
  return !/^(?:请欣赏|請欣賞)[。.\s]*$/iu.test(timedText);
}

export function parseLyrics(payload: LyricPayload): ParsedNeteaseLyrics {
  const lrc = payload.lrc?.lyric?.trim() || null;
  const yrc = payload.yrc?.lyric?.trim() || null;
  const credits: TrackCredits = {
    lyricists: [...EMPTY_CREDITS.lyricists],
    composers: [...EMPTY_CREDITS.composers],
    arrangers: [...EMPTY_CREDITS.arrangers],
  };

  for (const line of [
    ...linesFromRichText(lrc),
    ...linesFromRichText(yrc),
  ]) {
    applyCreditLine(credits, line);
  }

  const hasLyrics = containsRealLyrics(lrc);
  const richLyrics =
    lrc || yrc || payload.ytlrc?.lyric
      ? {
          lrc,
          yrc,
          translatedYrc: payload.ytlrc?.lyric?.trim() || null,
        }
      : null;

  return {
    originalLrc: hasLyrics ? lrc : null,
    translationLrc:
      payload.tlyric?.lyric?.trim() || payload.ytlrc?.lyric?.trim() || null,
    richLyrics,
    offsetMs: payload.offset ?? 0,
    hasLyrics,
    credits,
  };
}
