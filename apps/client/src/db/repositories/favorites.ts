import {
  favoriteRecordSchema,
  type FavoriteRecord,
} from "@resonara/contracts";
import { resonaraDb } from "../database";

export async function listFavorites(): Promise<FavoriteRecord[]> {
  return resonaraDb.favorites.orderBy("createdAt").reverse().toArray();
}

export async function getFavorite(
  trackId: string,
): Promise<FavoriteRecord | null> {
  const favorite = await resonaraDb.favorites.get(trackId);
  return favorite ? favoriteRecordSchema.parse(favorite) : null;
}

export async function addFavorite(favorite: FavoriteRecord): Promise<void> {
  const value = favoriteRecordSchema.parse(favorite);
  await resonaraDb.favorites.put(value);
}

export async function removeFavorite(trackId: string): Promise<void> {
  await resonaraDb.favorites.delete(trackId);
}

export async function getFavoritesByArtist(
  artist: string,
): Promise<FavoriteRecord[]> {
  return resonaraDb.favorites.where("track.artist").equals(artist).toArray();
}

export async function getFavoritesByCredit(
  role: "composer" | "lyricist",
  name: string,
): Promise<FavoriteRecord[]> {
  const index =
    role === "composer"
      ? "enrichment.credits.composers"
      : "enrichment.credits.lyricists";
  return resonaraDb.favorites.where(index).equals(name).toArray();
}
