import { useCallback, useEffect } from "react";
import type {
  FavoriteRecord,
  Track,
  TrackEnrichment,
} from "@resonara/contracts";
import {
  addFavorite,
  getFavorite,
  removeFavorite,
} from "../../db/repositories/favorites";
import { recordFeedback } from "../../db/repositories/feedback";
import {
  getProfile,
  saveProfile,
} from "../../db/repositories/profile";
import {
  applyProfileUpdate,
  createDefaultProfile,
} from "../../recommendation/profileUpdater";
import { create } from "zustand";

type FavoritesState = {
  records: Record<string, FavoriteRecord>;
  hydratedTrackIds: Record<string, boolean>;
  revisions: Record<string, number>;
  errors: Record<string, string | undefined>;
  hydrate: (trackId: string) => Promise<void>;
  toggle: (
    track: Track,
    enrichment?: TrackEnrichment,
  ) => Promise<void>;
};

function nextRevision(revisions: Record<string, number>, trackId: string) {
  return (revisions[trackId] ?? 0) + 1;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  records: {},
  hydratedTrackIds: {},
  revisions: {},
  errors: {},

  hydrate: async (trackId) => {
    if (get().hydratedTrackIds[trackId]) return;
    const revision = get().revisions[trackId] ?? 0;

    try {
      const favorite = await getFavorite(trackId);
      if ((get().revisions[trackId] ?? 0) !== revision) return;

      set((state) => {
        const records = { ...state.records };
        if (favorite) records[trackId] = favorite;
        else delete records[trackId];
        return {
          records,
          hydratedTrackIds: {
            ...state.hydratedTrackIds,
            [trackId]: true,
          },
        };
      });
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          [trackId]:
            error instanceof Error
              ? error.message
              : "Favorite state could not load.",
        },
        hydratedTrackIds: {
          ...state.hydratedTrackIds,
          [trackId]: true,
        },
      }));
    }
  },

  toggle: async (track, enrichment) => {
    const existing = get().records[track.id];
    const revision = nextRevision(get().revisions, track.id);
    const now = new Date().toISOString();
    const optimisticRecord: FavoriteRecord = {
      trackId: track.id,
      track,
      enrichment,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastVerifiedAt: now,
    };

    set((state) => {
      const records = { ...state.records };
      if (existing) delete records[track.id];
      else records[track.id] = optimisticRecord;
      return {
        records,
        revisions: { ...state.revisions, [track.id]: revision },
        errors: { ...state.errors, [track.id]: undefined },
      };
    });

    try {
      if (existing) {
        await removeFavorite(track.id);
        await recordFeedback({ trackId: track.id, event: "unliked" });
      } else {
        await addFavorite(optimisticRecord);
        await recordFeedback({ trackId: track.id, event: "liked" });
      }
      try {
        const profile = (await getProfile()) ?? createDefaultProfile();
        await saveProfile(
          applyProfileUpdate(profile, {
            event: existing ? "unliked" : "liked",
            track,
            enrichment,
          }),
        );
      } catch {
        // Favorite state remains valid if the derived profile cannot update.
      }
    } catch (error) {
      if ((get().revisions[track.id] ?? 0) !== revision) return;

      set((state) => {
        const records = { ...state.records };
        if (existing) records[track.id] = existing;
        else delete records[track.id];
        return {
          records,
          errors: {
            ...state.errors,
            [track.id]:
              error instanceof Error
                ? error.message
                : "Favorite state could not save.",
          },
        };
      });
    }
  },
}));

export function useFavorite(track: Track, enrichment?: TrackEnrichment) {
  const record = useFavoritesStore((state) => state.records[track.id]);
  const error = useFavoritesStore((state) => state.errors[track.id]);
  const hydrate = useFavoritesStore((state) => state.hydrate);
  const toggle = useFavoritesStore((state) => state.toggle);

  useEffect(() => {
    void hydrate(track.id);
  }, [hydrate, track.id]);

  const toggleFavorite = useCallback(
    () => toggle(track, enrichment),
    [enrichment, toggle, track],
  );

  return {
    isFavorite: Boolean(record),
    favoriteError: error ?? null,
    toggleFavorite,
  };
}
