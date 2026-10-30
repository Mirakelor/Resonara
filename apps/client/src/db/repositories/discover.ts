import type { DiscoverEdition } from "@resonara/contracts";
import { resonaraDb } from "../database";

export async function saveDiscoverEdition(
  edition: DiscoverEdition,
): Promise<void> {
  const timeZone = edition.timeZone ?? "UTC";
  await resonaraDb.discoverEditions.put({
    editionKey: `${edition.editionDate}::${timeZone}`,
    editionDate: edition.editionDate,
    value: edition,
    expiresAt: new Date(edition.expiresAt).toISOString(),
  });
}

export async function getDiscoverEdition(
  editionDate: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<DiscoverEdition | null> {
  const editionKey = `${editionDate}::${timeZone}`;
  const row = await resonaraDb.discoverEditions.get(editionKey);
  if (!row) return null;

  if (row.expiresAt <= now.toISOString()) {
    await resonaraDb.discoverEditions.delete(editionKey);
    return null;
  }

  return row.value;
}
