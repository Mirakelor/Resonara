import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Candidate,
  DiscoverEdition,
  ListeningContext,
} from "@resonara/contracts";
import { getSettings } from "../../db/repositories/settings";
import { getDiscoverEdition } from "../../db/repositories/discover";
import { createNeteaseProvider } from "../../services/netease/client";
import { verifyPlayableCandidates } from "../../recommendation/verifyPlayable";
import { generateDailyEdition } from "./generateDailyEdition";

function localDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function useDailyDiscover(context: ListeningContext) {
  const [edition, setEdition] = useState<DiscoverEdition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getSettings();
      const provider = createNeteaseProvider(settings);
      const editionDate = localDate(new Date(), context.timeZone);
      const cached = await getDiscoverEdition(
        editionDate,
        context.timeZone,
      );
      if (cached) {
        setEdition(cached);
        return cached;
      }

      const [recommended, newSongs] = await Promise.all([
        provider.getPublicRecommendations().catch(() => []),
        provider.getNewSongs(20).catch(() => []),
      ]);
      const raws = [...recommended, ...newSongs];
      const details = await provider
        .getTrackDetails([...new Set(raws.map(({ id }) => id))])
        .catch(() => []);
      const candidates: Candidate[] = details.flatMap((raw) =>
        raw.coverUrl
          ? [
              {
                track: {
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
                  playable: false,
                },
                sources: ["recommend_songs" as const],
                seedTrackIds: [],
                matchedDimensions: [],
                rawScore: null,
              },
            ]
          : [],
      );
      const verified = await verifyPlayableCandidates(candidates, provider, {
        maxResults: 40,
      });
      const next = await generateDailyEdition({
        candidates: verified,
        settings,
        context,
        editionDate,
      });
      setEdition(next);
      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Discover could not be generated.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void generate();
  }, [generate]);

  return {
    edition,
    loading,
    error,
    generate,
  };
}
