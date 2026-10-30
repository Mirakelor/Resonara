const baseUrl = (
  process.env.VITE_DEFAULT_MUSIC_API_BASE_URL ??
  "https://netease-cloud-music-api-enhanced-shiro.sonder.eu.org"
).replace(/\/+$/, "");

const results = [];
let failed = false;

async function request(path, validate) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!contentType.toLowerCase().includes("json")) {
      throw new Error("response was not JSON");
    }
    const body = await response.json();
    const summary = validate(body);
    results.push({
      endpoint: path.split("?")[0],
      status: "PASS",
      latencyMs: Math.round(performance.now() - startedAt),
      ...summary,
    });
    return body;
  } catch (error) {
    failed = true;
    results.push({
      endpoint: path.split("?")[0],
      status: "FAIL",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: error instanceof Error ? error.message : "unknown failure",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const search = await request(
  "/search?keywords=Tremolo%20Chilli%20Beans&limit=5",
  (body) => {
    if (!Array.isArray(body?.result?.songs)) {
      throw new Error("unexpected search shape");
    }
    return { resultCount: body.result.songs.length };
  },
);
const firstSong = search?.result?.songs?.[0];
const trackId = firstSong?.id;
const artistId = firstSong?.artists?.[0]?.id;

if (trackId) {
  await request(`/song/detail?ids=${trackId}`, (body) => {
    if (!Array.isArray(body?.songs) || !body.songs[0]?.id) {
      throw new Error("unexpected song-detail shape");
    }
    return {
      resultCount: body.songs.length,
      trackId: String(body.songs[0].id),
    };
  });
  await request(`/simi/song?id=${trackId}&limit=5`, (body) => {
    if (!Array.isArray(body?.songs)) {
      throw new Error("unexpected similar-songs shape");
    }
    return { resultCount: body.songs.length };
  });
  await request(`/song/wiki/summary?id=${trackId}`, (body) => {
    if (!Array.isArray(body?.data?.blocks)) {
      throw new Error("unexpected wiki shape");
    }
    return { resultCount: body.data.blocks.length };
  });
  await request(`/lyric/new?id=${trackId}`, (body) => {
    if (body?.code !== 200 || !("lrc" in body)) {
      throw new Error("unexpected lyrics shape");
    }
    return {
      lyricsPresent: Boolean(
        body?.lrc?.lyric || body?.yrc?.lyric || body?.tlyric?.lyric,
      ),
    };
  });
}

if (artistId) {
  await request(`/artist/songs?id=${artistId}&limit=5`, (body) => {
    if (!Array.isArray(body?.songs)) {
      throw new Error("unexpected artist-songs shape");
    }
    return { resultCount: body.songs.length };
  });
}

const recommendations = await request("/recommend/songs", (body) => {
  if (!Array.isArray(body?.data?.dailySongs)) {
    throw new Error("unexpected recommendations shape");
  }
  return { resultCount: body.data.dailySongs.length };
});

await request("/personalized/newsong?limit=5", (body) => {
  if (!Array.isArray(body?.result)) {
    throw new Error("unexpected new-songs shape");
  }
  return { resultCount: body.result.length };
});

const playbackIds = [
  ...(recommendations?.data?.dailySongs ?? []).map((song) => song.id),
]
  .filter(Boolean)
  .slice(0, 20);

if (playbackIds.length > 0) {
  await request(
    `/song/url/v1?id=${encodeURIComponent(playbackIds.join(","))}&level=standard`,
    (body) => {
      if (!Array.isArray(body?.data)) {
        throw new Error("unexpected playback shape");
      }
      const playableCount = body.data.filter(
        (item) => typeof item?.url === "string" && item.url.trim(),
      ).length;
      return {
        resultCount: body.data.length,
        playableCount,
      };
    },
  );
}

console.table(results);
if (failed) process.exitCode = 1;
