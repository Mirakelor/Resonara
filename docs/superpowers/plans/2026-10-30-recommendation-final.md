# Resonara Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the finalized Resonara recommendation experience as a fully local, frontend-only application with anonymous Netease playback, IndexedDB persistence, AI-assisted discovery, favorites, synchronized lyrics, and five-platform packaging.

**Architecture:** React and Vite provide the shared UI for web and Tauri 2. All recommendation, AI, weather, music-provider, persistence, player, and lyrics behavior runs in the client; Dexie stores durable state in IndexedDB. The Netease adapter only exposes anonymous endpoints and filters every recommendation source through a non-empty playback URL check.

**Tech Stack:** Node.js 22, pnpm, React 19, Vite 8, TypeScript, Zod, Dexie, TanStack Query, Zustand, Vitest, Testing Library, Playwright, Tauri 2, Rust, Android Media3/ExoPlayer, GitHub Actions.

**Spec:** `docs/design/recommendation-visual-baseline.md`

**Current baseline:** The finalized visual interface exists in `apps/client/src/App.tsx` and `apps/client/src/styles/app.css`. Recommendation data is still mocked in `apps/client/src/data/mockData.ts`. Shared data schemas and a server-oriented OpenAPI file exist under `packages/contracts`.

## Global Constraints

- The product is frontend-only. Do not create an API server, serverless functions, Postgres, cloud sync, or an internal account system.
- Do not implement Netease login, QR login, cookies, user profiles from Netease, or any behavior that requires a Netease account.
- Anonymous song availability is runtime-dependent. Every song in NOW, Mood, DISCOVER, fallback batches, play queues, and seed recommendations must have a non-empty URL from `/song/url/v1` before it is shown.
- Revalidate the playback URL when playback starts because anonymous URLs expire.
- Lyrics and audio are fetched anonymously. Missing lyrics are allowed and must hide the lyric surface without blocking playback.
- Persist all durable state in IndexedDB through Dexie. Do not add sync, backup, export-to-cloud, or account recovery.
- Do not add `Playback quality`, `City`, or `Use precise location` settings. Use `standard` playback quality.
- `Clear all data` deletes the whole IndexedDB database, restores the default Music API URL, and leaves AI fields empty.
- The default Music API base URL is `https://netease-cloud-music-api-enhanced-shiro.sonder.eu.org`.
- Use the finalized visual design. Add only the Settings entry, favorite toggles, and lyrics surface required by this plan.
- All interface copy remains English. Song titles, artists, credits, languages, and lyrics preserve their source language.
- Favorites are a primary recommendation source. The current thumb feedback is batch feedback and must not be reused as favorite state.
- Public `/recommend/songs` and `/personalized/newsong` are auxiliary sources, never the primary recommendation basis.
- AI may propose search terms, artists, and songs, but every proposal must resolve to a real anonymous track and pass metadata and playback validation before display.
- AI must not invent track IDs, credits, languages, genre tags, playback URLs, or lyrics.
- No secret or user-entered AI key may appear in source files, test fixtures, CI variables, or logs.
- Android is distributed as a sideloadable debug-signed APK. Windows and macOS artifacts are self-signed; no store or notarization workflow is required.
- No feature tiers. The four phases below are implementation milestones toward one final release.

---

## Phase 1: Local Foundation, Contracts, Settings, and IndexedDB

**Outcome:** The app runs without a backend, opens Settings, validates anonymous provider connections, and persists/clears all local data.

### Task 1.1: Initialize the repository and local dependencies

**Files:**
- Modify: `package.json`
- Modify: `apps/client/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: Existing pnpm workspace and Vite app.
- Produces: Installable client dependencies and scripts used by every later task.

- [x] Initialize Git if `.git` does not exist.
- [x] Add `dexie`, `@tanstack/react-query`, and `zustand` to the client.
- [x] Add `fake-indexeddb`, `@testing-library/react`, `@testing-library/user-event`, and `@playwright/test` as development dependencies.
- [x] Add scripts for `test`, `test:e2e`, `provider:smoke`, `typecheck`, `build`, `tauri:dev`, and `tauri:build`.
- [x] Add `.env.example` containing only development documentation:

```dotenv
# Values entered in the app are stored in IndexedDB.
# Do not put AI keys in Vite or Tauri build variables.
VITE_DEFAULT_MUSIC_API_BASE_URL=https://netease-cloud-music-api-enhanced-shiro.sonder.eu.org
```

- [x] Run `pnpm install`.
- [x] Run `pnpm typecheck && pnpm test && pnpm build`.
- [x] Include this task in the consolidated Phase 1 foundation commit.

### Task 1.2: Replace server contracts with local domain contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.test.ts`
- Delete or repurpose: `packages/contracts/openapi/recommendation.openapi.yaml`
- Create: `packages/contracts/src/providers.ts`
- Create: `packages/contracts/src/storage.ts`

**Interfaces:**
- Consumes: Existing `Track`, `RecommendationBatch`, `DiscoverEdition`, and `TasteProfile` schemas.
- Produces: Local `AppSettings`, `FavoriteRecord`, `TrackCredits`, `Candidate`, `ProviderResult`, and AI response schemas.

- [x] Remove bearer authentication, session, API-error, and server route schemas that imply a Resonara backend.
- [x] Extend `Track` with:

```ts
type TrackCredits = {
  lyricists: string[];
  composers: string[];
  arrangers: string[];
};

type TrackEnrichment = {
  credits: TrackCredits;
  genreTags: string[];
  recommendationTags: string[];
  language: string | null;
  instrumental: boolean;
  bpm: number | null;
};
```

- [x] Add `FavoriteRecord` with the complete track snapshot, enrichment, `createdAt`, `updatedAt`, and `lastVerifiedAt`.
- [x] Add `AppSettings` with exactly:

```ts
type AppSettings = {
  musicApiBaseUrl: string;
  musicApiToken: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
};
```

- [x] Add `CandidateSource` values for favorite similarity, AI context search, same artist, same lyricist, same composer, same language, same genre, AI song expansion, AI artist expansion, `recommend/songs`, and `personalized/newsong`.
- [x] Add `featuredTrackId` to `RecommendationBatch`.
- [x] Add optional `seedTrackId` and `source` to `RecommendationRequest`.
- [x] Add a `LyricsResponse` schema containing original LRC, translation, rich lyric data, offset, and `hasLyrics`.
- [x] Add an AI planner result schema and an AI reranker result schema; reject unknown track IDs during parsing.
- [x] Add tests proving:
  - Settings require a valid `http` or `https` music URL.
  - `featuredTrackId` must match one returned item.
  - A favorite snapshot with missing optional enrichment remains valid.
  - An AI result containing a track ID outside the supplied candidate list is rejected after validation.
- [x] Run contract tests.
- [x] Include this task in the consolidated Phase 1 foundation commit.

### Task 1.3: Create Dexie repositories and schema migration

**Files:**
- Create: `apps/client/src/db/database.ts`
- Create: `apps/client/src/db/schema.ts`
- Create: `apps/client/src/db/repositories/settings.ts`
- Create: `apps/client/src/db/repositories/profile.ts`
- Create: `apps/client/src/db/repositories/favorites.ts`
- Create: `apps/client/src/db/repositories/recommendations.ts`
- Create: `apps/client/src/db/repositories/discover.ts`
- Create: `apps/client/src/db/repositories/cache.ts`
- Create: `apps/client/src/db/database.test.ts`

**Interfaces:**
- Produces: `resonaraDb`, typed table accessors, `getSettings()`, `saveSettings()`, `clearAllData()`, favorite CRUD, profile access, batch access, and expiring cache helpers.

- [x] Define IndexedDB tables:

```text
settings
profile
favorites
feedbackEvents
recommendationBatches
discoverEditions
trackCache
lyricsCache
playbackCache
providerCache
aiDecisions
```

- [x] Use strings for timestamps so IndexedDB indexes sort predictably.
- [x] Keep one profile row with the fixed key `default`.
- [x] Add indexes for favorites by artist, genre, language, composer, lyricist, and creation date.
- [x] Add cache expiry checks on read.
- [x] Implement `clearAllData()` as `resonaraDb.delete()`, followed by reopening the DB.
- [x] Test with `fake-indexeddb`:
  - Default settings use the supplied Music API URL.
  - Saving settings survives a database close/reopen.
  - Favorite artist and credit indexes return expected rows.
  - Expired lyrics and playback cache entries are deleted.
  - `clearAllData()` removes all tables and restores defaults after reopen.
- [x] Include this task in the consolidated Phase 1 foundation commit.

### Task 1.4: Add the English Settings surface

**Files:**
- Create: `apps/client/src/features/settings/SettingsButton.tsx`
- Create: `apps/client/src/features/settings/SettingsPanel.tsx`
- Create: `apps/client/src/features/settings/useSettings.ts`
- Create: `apps/client/src/features/settings/SettingsPanel.test.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/components/Icon.tsx`
- Modify: `apps/client/src/styles/app.css`

**Interfaces:**
- Consumes: Settings repository and provider test functions.
- Produces: Persistent settings and a modal reachable from the existing top-right icon position.

- [x] Replace the decorative sun at the top-right of the NOW card with a gear button in the same visual size and position.
- [x] Build the panel with the current card, type, border, radius, and accent styles.
- [x] Render these fields only:
  - `Music API Base URL`
  - `Music API Access Token`
  - `AI API Base URL`
  - `AI API Key`
  - `AI Model`
- [x] Render these actions only:
  - `Test music connection`
  - `Test AI connection`
  - `Save`
  - `Cancel`
  - `Clear all data`
- [x] Prefill the default Music API URL on first launch.
- [x] Mask the token and API key by default.
- [x] Validate URL scheme and trim trailing slashes before saving.
- [x] Make `Clear all data` a destructive confirmation with the final action text `Delete all local data`.
- [x] After clearing, restore the default Music API URL and clear AI Base URL, AI Key, and AI Model.
- [x] Test:
  - Settings open and close with mouse and keyboard.
  - Default Music URL is visible on first launch.
  - No removed fields appear.
  - Saving persists after reopening the panel.
  - Cancel does not persist edits.
  - Clear all data removes favorites and resets the form.
- [x] Include this task in the consolidated Phase 1 foundation commit.

### Task 1.5: Build the shared HTTP and provider transports

**Files:**
- Create: `apps/client/src/services/http.ts`
- Create: `apps/client/src/services/providers/music.ts`
- Create: `apps/client/src/services/providers/ai.ts`
- Create: `apps/client/src/services/providers/weather.ts`
- Create: `apps/client/src/services/providers/providerErrors.ts`
- Create: `apps/client/src/services/providers/http.test.ts`

**Interfaces:**
- Produces: `requestJson<T>()`, `assertMusicConnection()`, `assertAIConnection()`, and provider error codes used by recommendation and playback.

- [x] Implement request timeouts with `AbortController`.
- [x] Use `fetch` for web.
- [ ] Add a Tauri HTTP implementation behind the same `requestJson()` interface in Phase 4.
- [x] Validate response content type before JSON parsing.
- [x] Convert network, CORS, timeout, HTTP, and schema failures into English provider errors.
- [x] Music connection test calls `/search?keywords=test&limit=1`.
- [x] AI connection test sends a fixed JSON-only prompt and validates a non-empty response.
- [x] Never log request headers, API keys, playback URLs, or lyric bodies.
- [x] Test all provider error classes with mocked fetch responses.
- [x] Include this task in the consolidated Phase 1 foundation commit.

**Phase 1 acceptance:**

- [x] A fresh install runs with the default Music API URL.
- [x] Settings persist and Clear all data resets the entire local database.
- [x] No backend process, server route, login endpoint, or Postgres dependency remains.
- [x] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

## Phase 2: Favorites, Anonymous Music Metadata, and Verified Candidate Retrieval

**Outcome:** Favorites work in the finalized UI, anonymous Netease endpoints are represented by tested adapters, and every candidate entering ranking has verified playback.

### Task 2.1: Implement favorite controls and repositories

**Files:**
- Modify: `apps/client/src/components/TrackCard.tsx`
- Modify: `apps/client/src/components/ExpandedPlayer.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/components/Icon.tsx`
- Modify: `apps/client/src/styles/app.css`
- Create: `apps/client/src/features/favorites/useFavorite.ts`
- Create: `apps/client/src/features/favorites/useFavorite.test.tsx`

**Interfaces:**
- Consumes: `favorites` repository and English UI copy.
- Produces: `toggleFavorite(track, enrichment)`, `isFavorite(trackId)`, and matching heart state in recommendation rows and the player.

- [x] Add a heart button beside each row play button without changing row height.
- [x] Add a heart button beside the current track title in the player without changing the five transport buttons.
- [x] Use outline heart for not saved and filled heart for saved.
- [x] Apply an optimistic update, then write the favorite snapshot to IndexedDB.
- [x] Roll back optimistic state if the IndexedDB write fails.
- [x] Remove a favorite on second click.
- [x] Record `liked` and `unliked` feedback events while preserving separate favorite state.
- [x] Test:
  - Favorite toggles in the recommendation row.
  - Favorite toggles in the player.
  - Both surfaces show the same state.
  - Reload restores favorite state from IndexedDB.
- [x] Commit with `feat: add persistent favorite controls`.

### Task 2.2: Implement the anonymous Netease adapter

**Files:**
- Create: `apps/client/src/services/netease/client.ts`
- Create: `apps/client/src/services/netease/mappers.ts`
- Create: `apps/client/src/services/netease/lyricParser.ts`
- Create: `apps/client/src/services/netease/credits.ts`
- Create: `apps/client/src/services/netease/wiki.ts`
- Create: `apps/client/src/services/netease/client.test.ts`
- Create: `tests/fixtures/netease/`

**Interfaces:**
- Produces:

```ts
interface NeteaseProvider {
  searchTracks(query: string, limit: number): Promise<RawTrack[]>;
  getTrackDetails(ids: string[]): Promise<TrackDetails[]>;
  getWikiSummary(trackId: string): Promise<TrackEnrichment>;
  getLyrics(trackId: string): Promise<LyricsResponse>;
  getSimilarSongs(trackId: string, limit: number): Promise<RawTrack[]>;
  getArtistSongs(artistId: string, limit: number): Promise<RawTrack[]>;
  getPublicRecommendations(): Promise<RawTrack[]>;
  getNewSongs(limit: number): Promise<RawTrack[]>;
  resolvePlaybackUrls(
    ids: string[],
  ): Promise<Map<string, PlaybackResolution>>;
}
```

- [x] Implement only anonymous endpoints:
  - `/recommend/songs`
  - `/personalized/newsong`
  - `/search`
  - `/simi/song`
  - `/artist/songs`
  - `/song/detail`
  - `/song/wiki/summary`
  - `/lyric/new`
  - `/song/url/v1`
- [x] Do not implement `/recommend/resource`, `/simi/artist`, or `/personalized/playlist`; anonymous probes returned login-required, login-required, and 404 respectively.
- [x] Map artist IDs and names from `/song/detail`.
- [x] Map language, genre tags, recommendation tags, instrumental flag, and BPM from `/song/wiki/summary`.
- [x] Parse LRC and rich lyric-credit structures from `/lyric/new`.
- [x] Normalize credits by trimming spaces, unifying punctuation, and case-folding Latin text.
- [x] Mark missing credits as empty arrays rather than inferring values.
- [x] Batch playback URL resolution in groups of at most 20 IDs.
- [x] Mark a track playable only when `data[].url` is a non-empty string.
- [x] Add an anonymous provider smoke script:

```bash
pnpm provider:smoke
```

The smoke script validates response shapes and prints endpoint latency, result counts, playable counts, and whether lyrics are present. External-service failures are diagnostic and do not fail the fixed-fixture unit suite.

- [x] Test fixtures for:
  - Search with five results.
  - Similar songs.
  - Artist songs.
  - Wiki genre/language/BPM tags.
  - Chinese and English lyric credits.
  - Instrumental lyrics.
  - Mixed playable and non-playable URL responses.
- [x] Commit with `feat: add tested anonymous Netease adapter`.

### Task 2.3: Build five-dimension taste seeds from favorites

**Files:**
- Create: `apps/client/src/recommendation/tasteSeed.ts`
- Create: `apps/client/src/recommendation/tasteSeed.test.ts`
- Create: `apps/client/src/services/netease/creditSearch.ts`
- Create: `apps/client/src/services/netease/creditSearch.test.ts`

**Interfaces:**
- Consumes: Favorite records, wiki enrichment, lyric credits, and artist IDs.
- Produces: `TasteSeed[]` with artist, lyricist, composer, language, and genre dimensions.

- [x] Build one `TasteSeed` per favorite.
- [x] Use artist IDs for same-artist lookup.
- [x] Use normalized name arrays for same-lyricist and same-composer lookup.
- [x] Search each credit name through `/search`.
- [x] Fetch `/lyric/new` for every credit-search candidate used to claim a credit match.
- [x] Keep a credit-search candidate only after an exact normalized credit match.
- [x] Fetch `/song/wiki/summary` for every same-language or same-genre candidate used to claim a tag match.
- [x] Treat missing tags as unknown; never let AI convert unknown into a verified match.
- [x] Test:
  - Same artist uses artist ID.
  - Same composer requires verified composer credit.
  - Same lyricist requires verified lyricist credit.
  - Missing credits skip that lane.
  - Japanese and English language tags map exactly.
  - `纯音乐` maps to `instrumental`, not language.
- [x] Commit with `feat: derive recommendation seeds from favorites`.

### Task 2.4: Implement the four primary candidate lanes

**Files:**
- Create: `apps/client/src/recommendation/sources/favoriteSimilar.ts`
- Create: `apps/client/src/recommendation/sources/contextSearch.ts`
- Create: `apps/client/src/recommendation/sources/sameDimensions.ts`
- Create: `apps/client/src/recommendation/sources/aiExpansion.ts`
- Create: `apps/client/src/recommendation/sources/publicFallback.ts`
- Create: `apps/client/src/recommendation/collectCandidates.ts`
- Create: `apps/client/src/recommendation/collectCandidates.test.ts`

**Interfaces:**
- Consumes: Taste seeds, provider adapter, AI planner output, recent feedback, and deterministic fallback queries.
- Produces: Deduplicated `Candidate[]` carrying every source and verified dimension match.

- [x] Candidate quotas:

```text
Favorite plus similar-songs lane       30%
AI context keyword-search lane         25%
Same-dimension lane                    25%
AI artist/song expansion lane          20%
```

- [x] `favoriteSimilar`: use up to three recent favorites and `/simi/song`.
- [x] `contextSearch`: use AI queries when available; otherwise use deterministic queries built from Mood, time bucket, weather condition, language, and genre.
- [x] `sameDimensions`: run artist, lyricist, composer, language, genre, and language-plus-genre paths with the priority order defined in the design.
- [x] `aiExpansion`: accept only AI-suggested artist names or search phrases; resolve every one through `/search`.
- [x] `publicFallback`: call `/recommend/songs` and `/personalized/newsong` only when primary lanes produce fewer than 12 playable candidates or when favorites are empty.
- [x] Merge duplicates by track ID and retain a set of all provenance paths.
- [x] Never mark a dimension match unless the corresponding metadata verification succeeded.
- [x] Cap the raw candidate pool at 80 tracks.
- [x] Test source quotas, duplicate merging, cold start, and fallback activation.
- [x] Commit with `feat: collect recommendations from four primary lanes`.

### Task 2.5: Enforce anonymous playability globally

**Files:**
- Create: `apps/client/src/recommendation/verifyPlayable.ts`
- Create: `apps/client/src/recommendation/verifyPlayable.test.ts`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/components/DiscoverGrid.tsx`
- Modify: `apps/client/src/components/PlayerDock.tsx`

**Interfaces:**
- Consumes: Raw candidates and `/song/url/v1`.
- Produces: `VerifiedCandidate[]` where every item has a non-empty URL and verification timestamp.

- [x] Resolve URLs in batches of 10–20.
- [x] Remove every candidate with `url === null`, empty URL, unsupported media type, or malformed response.
- [x] Keep a maximum candidate count of 40 after playability filtering.
- [x] Revalidate the final selected tracks immediately before writing the batch.
- [x] Revalidate again when playback starts.
- [x] Exclude every unplayable item from NOW, Mood, DISCOVER, seed results, cached results, and queue data.
- [x] When fewer than three verified tracks remain, continue the relevant source lanes until three are available.
- [x] Test empty URL, mixed URLs, all-null URLs, and URL-expiry fallback.
- [x] Commit with `feat: require anonymous playback for all recommendations`.

**Phase 2 acceptance:**

- [x] Favorite controls persist locally and appear in both required surfaces.
- [x] The anonymous adapter handles every provider endpoint used by the app.
- [x] Same-creator and same-tag claims require metadata verification.
- [x] All candidate lanes produce typed provenance.
- [x] No unplayable track can enter a recommendation result.
- [x] Provider fixtures and smoke tests pass.

---

## Phase 3: AI Recommendation, Context, Daily Discover, Playback, and Lyrics

**Outcome:** The final recommendation behavior, daily DISCOVER, local learning, playback, and synchronized lyrics run end-to-end without a backend.

### Task 3.1: Implement local context and weather

**Files:**
- Create: `apps/client/src/features/context/useListeningContext.ts`
- Create: `apps/client/src/services/weather/openMeteo.ts`
- Create: `apps/client/src/services/weather/weather.test.ts`
- Modify: `apps/client/src/App.tsx`

**Interfaces:**
- Produces: `ListeningContext` with device local time, timezone, coarse location, weather, and source status.

- [ ] Request browser/system location only when context is needed.
- [ ] Do not add city or location controls to Settings.
- [ ] If permission is denied or geolocation fails, return a context without weather.
- [ ] Cache weather for 15 minutes in IndexedDB.
- [ ] Keep `Use my current environment` selected by default.
- [ ] When `Ignore the environment` is selected, set weather to `null` in the recommendation request.
- [ ] Test success, denial, timeout, and cached weather.
- [ ] Commit with `feat: add local context and weather`.

### Task 3.2: Implement AI planner, reranker, and explanation writer

**Files:**
- Create: `apps/client/src/services/ai/client.ts`
- Create: `apps/client/src/recommendation/aiPlanner.ts`
- Create: `apps/client/src/recommendation/aiReranker.ts`
- Create: `apps/client/src/recommendation/explanationWriter.ts`
- Create: `apps/client/src/recommendation/aiPipeline.test.ts`
- Create: `apps/client/src/recommendation/localFallback.ts`
- Modify: `packages/contracts/src/providers.ts`

**Interfaces:**
- Produces:

```ts
type PlanRecommendation = (input: {
  profile: TasteProfile;
  favorites: FavoriteRecord[];
  context: ListeningContext;
  intent: ListeningIntent;
  recentEvents: FeedbackEvent[];
}) => Promise<RecommendationPlan>;

type RerankCandidates = (input: {
  plan: RecommendationPlan;
  candidates: VerifiedCandidate[];
}) => Promise<AIRerankResult>;
```

- [ ] Use an OpenAI-compatible JSON request against the configured AI Base URL.
- [ ] The planner outputs context summary, target dimensions, search queries, artist ideas, and song ideas.
- [ ] The reranker receives only verified candidates.
- [ ] Reject IDs not present in the candidate set.
- [ ] Reject candidates that violate artist diversity or explicit dislike rules.
- [ ] Ask the reranker to preserve at least one non-favorite artist when enough candidates exist.
- [ ] Write English explanations from verified metadata only.
- [ ] Persist the AI request purpose, result summary, and fallback reason in `aiDecisions`; never persist the API key.
- [ ] Implement local fallback scoring:

```text
0.35 favorite similarity
0.20 context match
0.20 intent match
0.15 dimension match
0.10 diversity
```

- [ ] Test valid reranking, out-of-pool IDs, unplayable IDs, duplicate artists, AI timeout, malformed JSON, and missing API key.
- [ ] Commit with `feat: add AI-guided recommendation ranking`.

### Task 3.3: Implement final recommendation assembly

**Files:**
- Create: `apps/client/src/recommendation/recommend.ts`
- Create: `apps/client/src/recommendation/recommend.test.ts`
- Create: `apps/client/src/features/recommendations/useRecommendationBatch.ts`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/data/mockData.ts`

**Interfaces:**
- Consumes: context, favorites, verified candidates, AI reranking, and recent events.
- Produces: `RecommendationBatch` with exactly three verified items and one `featuredTrackId`.

- [ ] Replace mock recommendation rendering with `useRecommendationBatch()`.
- [ ] Keep the mock file only for tests and Storybook-style local fixtures.
- [ ] Make clicking any Mood run one recommendation request.
- [ ] Disable duplicate requests while one is in flight.
- [ ] Apply favorite similarity, five-dimension candidates, AI context search, and AI expansion.
- [ ] Keep `/recommend/songs` and `/personalized/newsong` as fallback only.
- [ ] Pick `featuredTrackId` from the final verified items.
- [ ] Save the batch and its provenance in IndexedDB.
- [ ] Use the cached batch only after all its tracks pass a fresh URL check.
- [ ] Test cold start, favorite-based recommendation, environment switching, refresh, cached recovery, and exactly three playable outputs.
- [ ] Commit with `feat: assemble final local recommendation batches`.

### Task 3.4: Implement daily DISCOVER

**Files:**
- Create: `apps/client/src/features/discover/generateDailyEdition.ts`
- Create: `apps/client/src/features/discover/useDailyDiscover.ts`
- Create: `apps/client/src/features/discover/generateDailyEdition.test.ts`
- Modify: `apps/client/src/components/DiscoverGrid.tsx`
- Modify: `apps/client/src/App.tsx`

**Interfaces:**
- Produces: A stable four-card edition keyed by local date and timezone.

- [ ] Generate exactly four unique tracks from the verified daily candidate pool.
- [ ] Require every card track to have a non-empty URL.
- [ ] Use each track’s cover as the card image.
- [ ] Ask AI for four English card titles and short context labels.
- [ ] Use deterministic English title templates when AI is unavailable.
- [ ] Save the edition under `editionDate + timeZone`.
- [ ] Reuse the saved edition throughout the local day.
- [ ] Invalidate and regenerate after the local date changes.
- [ ] Clicking a card sets its `seedTrackId`, triggers a recommendation batch, and opens the selected track.
- [ ] Ensure the clicked seed track is present in the returned verified batch.
- [ ] Test four-card uniqueness, daily stability, day rollover, missing AI key, and unplayable-card replacement.
- [ ] Commit with `feat: add local daily Discover editions`.

### Task 3.5: Implement the audio engine and synchronized lyrics

**Files:**
- Create: `apps/client/src/features/player/usePlayerController.ts`
- Create: `apps/client/src/features/player/AudioEngine.ts`
- Create: `apps/client/src/features/player/webAudioEngine.ts`
- Create: `apps/client/src/features/player/lyrics.ts`
- Create: `apps/client/src/features/player/LyricsPanel.tsx`
- Create: `apps/client/src/features/player/usePlayerController.test.ts`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/components/ExpandedPlayer.tsx`
- Modify: `apps/client/src/components/PlayerDock.tsx`
- Modify: `apps/client/src/styles/app.css`

**Interfaces:**
- Consumes: verified tracks, playback resolver, and `/lyric/new`.
- Produces: `PlayerController` with `play`, `pause`, `seek`, `restart`, `next`, `previous`, `setVolume`, lyric state, and queue state.

- [ ] Move audio state out of `App.tsx`.
- [ ] Resolve a fresh URL on play.
- [ ] Restart sets `currentTime` to zero and preserves the playing state.
- [ ] Keep the five transport buttons in their finalized order.
- [ ] Pre-resolve the next track URL without starting playback.
- [ ] Parse original LRC, rich lyric data, and translation.
- [ ] Use binary search to select the active lyric line.
- [ ] Synchronize after play, pause, seek, restart, and track change.
- [ ] Hide the lyrics button and surface when lyrics are unavailable.
- [ ] On playback failure, notify the user and advance to the next verified track.
- [ ] Test URL refresh, restart, previous, next, queue completion, lyric offset, seek, and instrumental tracks.
- [ ] Commit with `feat: add anonymous playback and synchronized lyrics`.

### Task 3.6: Update the single long-term profile

**Files:**
- Create: `apps/client/src/recommendation/profileUpdater.ts`
- Create: `apps/client/src/recommendation/profileUpdater.test.ts`
- Create: `apps/client/src/features/profile/useFeedback.ts`
- Modify: `apps/client/src/App.tsx`

**Interfaces:**
- Consumes: favorites, play events, skips, completion, refresh, and thumb feedback.
- Produces: One versioned `TasteProfile` stored in IndexedDB.

- [ ] Favorite adds strong positive weight to track, artist, credits, language, and genre.
- [ ] Repeat play adds strong positive weight.
- [ ] Full completion adds medium positive weight.
- [ ] Skip before 30 seconds adds weak negative weight.
- [ ] Explicit dislike adds strong negative weight.
- [ ] Batch thumbs affect context affinity rather than permanently rejecting every track.
- [ ] Temperature, humidity, time, and weather affinities are stored inside the same profile object.
- [ ] Apply time decay to older observations.
- [ ] Test that one early skip does not erase a favorite track or artist.
- [ ] Commit with `feat: learn a local long-term recommendation profile`.

**Phase 3 acceptance:**

- [ ] AI receives favorites and verified candidate metadata and materially participates in source planning and reranking.
- [ ] Cold-start recommendations work without favorites or an AI key.
- [ ] Favorites activate the four main source lanes.
- [ ] NOW and Mood always contain three anonymous playable tracks.
- [ ] DISCOVER always contains four anonymous playable tracks with song covers and stable daily AI titles.
- [ ] Dynamic lyrics follow playback, seeking, and restart.
- [ ] No recommendation path can display a track with an empty playback URL.

---

## Phase 4: Tauri Integration, Automated Packaging, and Release Validation

**Outcome:** The same local-first application builds and runs on Web, Android, Windows, macOS, and Linux through GitHub Actions.

### Task 4.1: Add the Tauri application and platform capabilities

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Modify: `package.json`
- Modify: `apps/client/vite.config.ts`

**Interfaces:**
- Produces: Tauri 2 shell for Android and desktop using the existing Vite client.

- [ ] Configure the client development URL and production web assets.
- [ ] Add capabilities for HTTP, geolocation, shell open, and media notification only.
- [ ] Use the same app identifier and icon on all platforms.
- [ ] Add the Tauri HTTP adapter without reopening provider logic.
- [ ] Open external track-provider links through the system browser only when requested.
- [ ] Test desktop startup with an empty database and with initialized settings.
- [ ] Commit with `feat: add Tauri cross-platform shell`.

### Task 4.2: Add Android background playback

**Files:**
- Create: `src-tauri/plugins/audio-service/Cargo.toml`
- Create: `src-tauri/plugins/audio-service/src/lib.rs`
- Create: `src-tauri/plugins/audio-service/android/src/main/AndroidManifest.xml`
- Create: `src-tauri/plugins/audio-service/android/src/main/java/com/resonara/audio/AudioService.kt`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Produces: Android playback service implementing the existing `AudioEngine` commands.

- [ ] Use Media3/ExoPlayer in a foreground service.
- [ ] Show title, artist, cover, play/pause, previous, and next in the notification.
- [ ] Keep the JavaScript queue as the source of truth.
- [ ] Pause on audio focus loss and resume only when permitted.
- [ ] Persist the current queue and position across app restarts.
- [ ] Test on a real Android device with screen locked and app backgrounded.
- [ ] Commit with `feat: add Android background audio`.

### Task 4.3: Configure GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `scripts/check-provider-smoke.mjs`
- Create: `scripts/generate-windows-self-signed.ps1`
- Create: `scripts/sign-macos-adhoc.sh`

**Interfaces:**
- Produces: Reproducible checks and release artifacts without backend deployment.

- [ ] CI runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and Playwright against a mocked provider.
- [ ] Provider smoke tests run as a separate manual workflow because external availability is not deterministic.
- [ ] Release workflow matrix:
  - Web static output
  - Android `.apk`
  - Windows EXE/MSI
  - macOS arm64 DMG
  - macOS x64 DMG
  - Linux AppImage
  - Linux deb
- [ ] Android uses debug signing and produces no AAB.
- [ ] Windows generates a self-signed certificate, signs artifacts, and uploads the public certificate.
- [ ] macOS uses ad-hoc/self-signing and uploads the DMG; no notarization step.
- [ ] Upload SHA256 manifests and installation instructions.
- [ ] Do not inject AI keys or Music API tokens into build artifacts.
- [ ] Commit with `ci: add local-first multi-platform builds`.

### Task 4.4: Add end-to-end and visual regression coverage

**Files:**
- Create: `tests/e2e/fixtures/provider.ts`
- Create: `tests/e2e/first-run.spec.ts`
- Create: `tests/e2e/favorites.spec.ts`
- Create: `tests/e2e/recommendations.spec.ts`
- Create: `tests/e2e/discover.spec.ts`
- Create: `tests/e2e/player-lyrics.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces: Deterministic browser coverage for every core workflow.

- [ ] Mock Netease responses through request interception.
- [ ] Mock a mix of playable and non-playable candidates and assert only playable tracks appear.
- [ ] Test Settings connection errors and successful provider responses.
- [ ] Test favorite toggle and persistence after reload.
- [ ] Test Mood selection, environment default, environment ignore mode, and Refresh.
- [ ] Test four-card DISCOVER daily stability and seed playback.
- [ ] Test Restart, seek, next, volume, and active lyric line.
- [ ] Capture visual baselines at 1440×1000 and 390×844.
- [ ] Commit with `test: cover the complete local recommendation flow`.

### Task 4.5: Final acceptance and release checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/design/recommendation-visual-baseline.md`
- Create: `docs/release/installation.md`

**Interfaces:**
- Produces: Installable builds and documented limitations.

- [ ] Verify a fresh install opens with the default Music API URL.
- [ ] Verify no Netease login UI or network call exists.
- [ ] Verify AI settings remain local.
- [ ] Verify all recommendation surfaces omit tracks whose playback URL is empty.
- [ ] Verify DISCOVER cards are track-backed, unique, playable, and stable for one local day.
- [ ] Verify favorites drive similar songs and five-dimension searches.
- [ ] Verify all IndexedDB data disappears after `Clear all data`.
- [ ] Verify lyrics sync, missing lyrics fallback, and instrumental fallback.
- [ ] Build and install:
  - Android APK
  - Windows self-signed EXE/MSI
  - macOS arm64 and x64 DMG
  - Linux AppImage and deb
  - Web static build
- [ ] Document Android unknown-source installation.
- [ ] Document Windows certificate trust and SmartScreen behavior.
- [ ] Document macOS Gatekeeper “Open” behavior.
- [ ] Commit with `docs: prepare the final recommendation release`.

**Phase 4 acceptance:**

- [ ] All platform builds complete in GitHub Actions.
- [ ] No official keystore, paid certificate, notarization account, backend, or database is required.
- [ ] Every platform persists data locally and runs without network services other than the configured providers.
- [ ] The finalized visual layout remains intact except for the Settings entry, favorite controls, and lyrics surface.

---

## Final Verification Commands

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm provider:smoke
pnpm tauri:build
```

Expected:

- TypeScript reports no errors.
- Unit and component tests pass with fixtures.
- Playwright passes the complete local workflow.
- Production web build succeeds.
- Provider smoke output identifies any currently failing anonymous endpoint without exposing keys or playback URLs.
- Platform builds produce the configured unsigned, self-signed, or debug-signed artifacts.

## Approval Gate

Implementation starts only after approval of this four-phase plan. No application behavior will change before that approval.
