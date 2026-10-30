import {
  appSettingsSchema,
  type AppSettings,
} from "@resonara/contracts";
import {
  DEFAULT_SETTINGS,
  resonaraDb,
} from "../database";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function getSettings(): Promise<AppSettings> {
  const row = await resonaraDb.settings.get("default");
  if (!row) return { ...DEFAULT_SETTINGS };

  return appSettingsSchema.parse(row.value);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = appSettingsSchema.parse({
    ...settings,
    musicApiBaseUrl: normalizeBaseUrl(settings.musicApiBaseUrl),
  });

  await resonaraDb.settings.put({
    key: "default",
    value: normalized,
    updatedAt: new Date().toISOString(),
  });

  return normalized;
}
