import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EnvironmentMode,
  ListeningContext,
  ListeningIntent,
  RecommendationBatch,
} from "@resonara/contracts";
import { getSettings } from "../../db/repositories/settings";
import { getProfile } from "../../db/repositories/profile";
import { listFavorites } from "../../db/repositories/favorites";
import { listRecentFeedback } from "../../db/repositories/feedback";
import {
  getLatestRecommendationBatch,
  saveRecommendationBatch,
} from "../../db/repositories/recommendations";
import {
  generateRecommendationBatch,
  isRecommendationBatchPlayable,
} from "../../recommendation/recommend";
import { createNeteaseProvider } from "../../services/netease/client";

type RequestOptions = {
  intent?: ListeningIntent | null;
  seedTrackId?: string;
  context?: ListeningContext;
  useCache?: boolean;
  environmentMode?: EnvironmentMode;
};

export function useRecommendationBatch(input: {
  context: ListeningContext;
  contextReady: boolean;
  environmentMode: EnvironmentMode;
  selectedIntent: ListeningIntent | null;
}) {
  const [batch, setBatch] = useState<RecommendationBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const initialRequested = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const generate = useCallback(
    async (request: RequestOptions = {}) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setLoading(true);
      setError(null);

      try {
        const settings = await getSettings();
        const provider = createNeteaseProvider(settings);
        if (request.useCache !== false) {
          const cached = await getLatestRecommendationBatch();
          if (
            cached &&
            (await isRecommendationBatchPlayable(cached, provider))
          ) {
            if (mounted.current) setBatch(cached);
            return cached;
          }
        }

        const favorites = await listFavorites();
        const profile =
          (await getProfile()) ?? {
            updatedAt: new Date().toISOString(),
            topGenres: [],
            topArtists: [],
            energyPreference: 0.5,
            familiarityPreference: 0.5,
            contextAffinities: [],
          };
        const next = await generateRecommendationBatch(
          {
            settings,
            profile,
            favorites,
            context:
              (request.environmentMode ?? input.environmentMode) ===
              "ignore_environment"
                ? {
                    ...(request.context ?? input.context),
                    weather: null,
                    weatherSource: "unavailable",
                  }
                : (request.context ?? input.context),
            environmentMode:
              request.environmentMode ?? input.environmentMode,
            intent:
              request.intent ??
              input.selectedIntent ??
              "feel_good",
            recentEvents: await listRecentFeedback(),
            seedTrackId: request.seedTrackId,
          },
          { provider, persist: saveRecommendationBatch },
        );
        if (mounted.current) setBatch(next);
        return next;
      } catch (caught) {
        if (mounted.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Recommendations could not be generated.",
          );
        }
        return null;
      } finally {
        inFlight.current = false;
        if (mounted.current) setLoading(false);
      }
    },
    [
      input.context,
      input.contextReady,
      input.environmentMode,
      input.selectedIntent,
    ],
  );

  useEffect(() => {
    if (!input.contextReady || initialRequested.current) return;
    initialRequested.current = true;
    void generate({ useCache: true });
  }, [generate, input.contextReady]);

  return {
    batch,
    loading,
    error,
    generate,
    refresh: (seedTrackId?: string) =>
      generate({ seedTrackId, useCache: false }),
  };
}
