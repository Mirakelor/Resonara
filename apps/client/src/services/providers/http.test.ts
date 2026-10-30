import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requestJson } from "../http";
import { assertAIConnection } from "./ai";
import { ProviderRequestError } from "./providerErrors";
import { assertMusicConnection } from "./music";
import { requestCurrentWeather } from "./weather";

const settings = {
  musicApiBaseUrl: "https://music.example.test",
  musicApiToken: "music-token",
  aiBaseUrl: "https://ai.example.test/v1",
  aiApiKey: "ai-key",
  aiModel: "test-model",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  it("returns validated JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      requestJson(
        "https://example.test/data",
        {},
        z.object({ ok: z.boolean() }),
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("converts an HTTP failure into an English provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(requestJson("https://example.test/data", {})).rejects.toMatchObject({
      code: "http",
      status: 503,
      message: "The provider returned HTTP 503.",
    });
  });

  it("rejects a non-JSON response before parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Not JSON</html>", {
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    await expect(requestJson("https://example.test/data", {})).rejects.toMatchObject({
      code: "content_type",
    });
  });

  it("converts invalid response data into a schema error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: "yes" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      requestJson(
        "https://example.test/data",
        {},
        z.object({ ok: z.boolean() }),
      ),
    ).rejects.toMatchObject({ code: "schema" });
  });

  it("classifies network and CORS failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network connection lost")),
    );
    await expect(requestJson("https://example.test/data", {})).rejects.toMatchObject({
      code: "network",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("CORS blocked this request")),
    );
    await expect(requestJson("https://example.test/data", {})).rejects.toMatchObject({
      code: "cors",
    });
  });

  it("aborts requests that exceed the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    await expect(
      requestJson("https://example.test/data", {}, undefined, { timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("connection checks", () => {
  it("uses the anonymous music search endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { songs: [] } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await assertMusicConnection(settings);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://music.example.test/search?keywords=test&limit=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer music-token",
        }),
      }),
    );
  });

  it("sends a JSON-only prompt to the configured AI endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await assertAIConnection(settings);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ai-key",
        }),
      }),
    );
  });

  it("exposes provider errors as typed errors", () => {
    const error = new ProviderRequestError("network", "No connection", null);

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("network");
  });

  it("requests a compact current-weather snapshot from Open-Meteo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          current: {
            time: "2026-10-30T14:00",
            temperature_2m: 28,
            apparent_temperature: 31,
            relative_humidity_2m: 75,
            weather_code: 3,
            is_day: 1,
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCurrentWeather(31.23, 121.47)).resolves.toMatchObject({
      current: { temperature_2m: 28 },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "latitude=31.23&longitude=121.47",
    );
  });
});
