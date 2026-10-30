import type { AppSettings } from "@resonara/contracts";
import { z } from "zod";
import { requestJson } from "../http";
import { ProviderRequestError } from "./providerErrors";

const searchResponseSchema = z
  .object({ result: z.unknown() })
  .passthrough();

function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new ProviderRequestError(
      "configuration",
      "Enter a Music API Base URL first.",
      null,
    );
  }
  return normalized;
}

export async function assertMusicConnection(
  settings: AppSettings,
): Promise<void> {
  const baseUrl = normalizeBaseUrl(settings.musicApiBaseUrl);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (settings.musicApiToken.trim()) {
    headers.Authorization = `Bearer ${settings.musicApiToken.trim()}`;
  }

  await requestJson(
    `${baseUrl}/search?keywords=test&limit=1`,
    { headers },
    searchResponseSchema,
  );
}
