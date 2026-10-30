import type { Track } from "@resonara/contracts";
import { resonaraDb } from "../database";
import type { ExpiringCacheRow } from "../schema";

async function getExpiringValue<T>(
  row: ExpiringCacheRow<T> | undefined,
  deleteEntry: () => Promise<unknown>,
  now: Date,
): Promise<T | null> {
  if (!row) return null;

  if (row.expiresAt <= now.toISOString()) {
    await deleteEntry();
    return null;
  }

  return row.value;
}

async function setExpiringValue<T>(
  key: string,
  value: T,
  expiresAt: string,
  put: (row: ExpiringCacheRow<T>) => Promise<string>,
): Promise<void> {
  const createdAt = new Date().toISOString();
  await put({
    key,
    value,
    expiresAt: new Date(expiresAt).toISOString(),
    createdAt,
  });
}

export async function getTrackCache(trackId: string): Promise<Track | null> {
  const row = await resonaraDb.trackCache.get(trackId);
  return row?.value ?? null;
}

export async function setTrackCache(track: Track): Promise<void> {
  await resonaraDb.trackCache.put({
    trackId: track.id,
    value: track,
    fetchedAt: new Date().toISOString(),
  });
}

export async function getLyricsCache(
  trackId: string,
  now = new Date(),
): Promise<unknown | null> {
  const row = await resonaraDb.lyricsCache.get(trackId);
  return getExpiringValue(
    row,
    () => resonaraDb.lyricsCache.delete(trackId),
    now,
  );
}

export async function setLyricsCache(
  trackId: string,
  value: unknown,
  expiresAt: string,
): Promise<void> {
  await setExpiringValue(
    trackId,
    value,
    expiresAt,
    (row) => resonaraDb.lyricsCache.put(row),
  );
}

export async function getPlaybackCache(
  trackId: string,
  now = new Date(),
): Promise<unknown | null> {
  const row = await resonaraDb.playbackCache.get(trackId);
  return getExpiringValue(
    row,
    () => resonaraDb.playbackCache.delete(trackId),
    now,
  );
}

export async function setPlaybackCache(
  trackId: string,
  value: unknown,
  expiresAt: string,
): Promise<void> {
  await setExpiringValue(
    trackId,
    value,
    expiresAt,
    (row) => resonaraDb.playbackCache.put(row),
  );
}

export async function getProviderCache(
  key: string,
  now = new Date(),
): Promise<unknown | null> {
  const row = await resonaraDb.providerCache.get(key);
  return getExpiringValue(
    row,
    () => resonaraDb.providerCache.delete(key),
    now,
  );
}

export async function setProviderCache(
  key: string,
  value: unknown,
  expiresAt: string,
): Promise<void> {
  await setExpiringValue(
    key,
    value,
    expiresAt,
    (row) => resonaraDb.providerCache.put(row),
  );
}
