import type { DiscoverEdition } from "@resonara/contracts";
import { resonaraDb } from "../database";

export async function saveDiscoverEdition(
  edition: DiscoverEdition,
): Promise<void> {
  await resonaraDb.discoverEditions.put({
    editionDate: edition.editionDate,
    value: edition,
    expiresAt: new Date(edition.expiresAt).toISOString(),
  });
}

export async function getDiscoverEdition(
  editionDate: string,
  now = new Date(),
): Promise<DiscoverEdition | null> {
  const row = await resonaraDb.discoverEditions.get(editionDate);
  if (!row) return null;

  if (row.expiresAt <= now.toISOString()) {
    await resonaraDb.discoverEditions.delete(editionDate);
    return null;
  }

  return row.value;
}
