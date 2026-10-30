import type { z } from "zod";
import { ProviderRequestError } from "./providers/providerErrors";

type RequestJsonOptions = {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;

function isJsonContentType(contentType: string | null) {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json");
}

export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  schema?: z.ZodType<T>,
  options: RequestJsonOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderRequestError(
        "http",
        `The provider returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!isJsonContentType(contentType)) {
      throw new ProviderRequestError(
        "content_type",
        "The provider returned a response that is not JSON.",
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ProviderRequestError(
        "schema",
        "The provider returned malformed JSON.",
        response.status,
      );
    }

    if (!schema) return data as T;

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderRequestError(
        "schema",
        "The provider returned data in an unexpected format.",
        response.status,
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProviderRequestError(
        "timeout",
        "The provider took too long to respond.",
        null,
      );
    }

    if (error instanceof TypeError) {
      const message = error.message.toLowerCase();
      if (message.includes("cors") || message.includes("cross-origin")) {
        throw new ProviderRequestError(
          "cors",
          "The provider blocked this browser request with CORS.",
          null,
        );
      }

      throw new ProviderRequestError(
        "network",
        "The provider could not be reached. Check your connection.",
        null,
      );
    }

    throw new ProviderRequestError(
      "network",
      "The provider request failed unexpectedly.",
      null,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
