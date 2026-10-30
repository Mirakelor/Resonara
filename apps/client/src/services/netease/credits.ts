import type { TrackCredits } from "@resonara/contracts";

export const EMPTY_CREDITS: TrackCredits = {
  lyricists: [],
  composers: [],
  arrangers: [],
};

export function normalizeCreditName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[，、;；/／|]+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNames(value: string): string[] {
  return value
    .split(/[，、,;；/／|&＆]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function appendUniqueNames(target: string[], names: string[]): void {
  const seen = new Set(target.map(normalizeCreditName));
  for (const name of names) {
    const normalized = normalizeCreditName(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    target.push(name);
  }
}

export function applyCreditLine(
  credits: TrackCredits,
  line: string,
): boolean {
  const normalized = line.normalize("NFKC").trim();
  const labels: Array<{
    pattern: RegExp;
    target: keyof TrackCredits;
  }> = [
    {
      pattern: /^(?:作词|作詞|lyricists?|lyrics)\s*[:：]\s*(.+)$/iu,
      target: "lyricists",
    },
    {
      pattern: /^(?:作曲|composers?|composed\s+by|music\s+by)\s*[:：]\s*(.+)$/iu,
      target: "composers",
    },
    {
      pattern: /^(?:编曲|編曲|arrangers?|arranged\s+by)\s*[:：]\s*(.+)$/iu,
      target: "arrangers",
    },
  ];

  for (const { pattern, target } of labels) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    appendUniqueNames(credits[target], splitNames(match[1]));
    return true;
  }

  return false;
}
