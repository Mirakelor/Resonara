const baseUrl = (
  process.env.VITE_DEFAULT_MUSIC_API_BASE_URL ??
  "https://netease-cloud-music-api-enhanced-shiro.sonder.eu.org"
).replace(/\/+$/, "");

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(
    `${baseUrl}/search?keywords=test&limit=1`,
    {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error("Provider did not return JSON");
  }

  await response.json();
  console.log("Anonymous music provider smoke test passed.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(`Anonymous music provider smoke test failed: ${message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
