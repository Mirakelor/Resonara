import {
  tasteProfileSchema,
  type TasteProfile,
} from "@resonara/contracts";
import { resonaraDb } from "../database";

export async function getProfile(): Promise<TasteProfile | null> {
  const row = await resonaraDb.profile.get("default");
  return row ? tasteProfileSchema.parse(row.value) : null;
}

export async function saveProfile(profile: TasteProfile): Promise<void> {
  const value = tasteProfileSchema.parse(profile);
  await resonaraDb.profile.put({
    id: "default",
    value,
    updatedAt: value.updatedAt,
  });
}
