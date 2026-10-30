import type { LyricsResponse } from "@resonara/contracts";

export type LyricLine = {
  timeMs: number;
  text: string;
};

export type TranslationMap = Map<number, string>;

function parseTimestamp(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = Number((match[3] ?? "0").padEnd(3, "0"));
  return minutes * 60_000 + seconds * 1_000 + fraction;
}

export function parseLrc(lrc: string | null): LyricLine[] {
  if (!lrc) return [];
  const lines: LyricLine[] = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    const timestamps = [
      ...rawLine.matchAll(/\[([^\]]+)]/g),
    ].flatMap((match) => {
      const timestamp = match[1] ? parseTimestamp(match[1]) : null;
      return timestamp === null ? [] : [timestamp];
    });
    if (timestamps.length === 0) continue;
    const text = rawLine.replace(/\[[^\]]+]/g, "").trim();
    if (!text) continue;
    for (const timeMs of timestamps) lines.push({ timeMs, text });
  }

  return lines.sort((left, right) => left.timeMs - right.timeMs);
}

export function parseTranslationLrc(
  lrc: string | null,
): TranslationMap {
  return new Map(
    parseLrc(lrc).map(({ timeMs, text }) => [timeMs, text]),
  );
}

export function getActiveLyricIndex(
  lines: LyricLine[],
  currentTimeMs: number,
  offsetMs = 0,
): number {
  const time = currentTimeMs - offsetMs;
  let low = 0;
  let high = lines.length - 1;
  let active = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const line = lines[middle];
    if (!line) break;
    if (line.timeMs <= time) {
      active = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return active;
}

export function parseLyricsResponse(response: LyricsResponse) {
  return {
    lines: response.hasLyrics ? parseLrc(response.originalLrc) : [],
    translations: response.hasLyrics
      ? parseTranslationLrc(response.translationLrc)
      : new Map<number, string>(),
    offsetMs: response.offsetMs,
    hasLyrics: response.hasLyrics,
  };
}
