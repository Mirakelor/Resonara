# Resonara

Context-aware music recommendations built around the right music for the right moment.

Web deployment target: [resonara.sonder.eu.org](https://resonara.sonder.eu.org)

The web application now includes the complete local-first recommendation flow:
real anonymous candidate retrieval, AI planning and reranking, daily Discover,
persistent favorites, a local learning profile, synchronized lyrics, and
verified playback. Cross-platform packaging remains the final implementation
milestone.

## Run

```bash
pnpm install
pnpm dev
```

The visual baseline runs at `http://localhost:4173`.

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
```

Additional checks:

```bash
pnpm test:e2e
pnpm provider:smoke
RESONARA_AI_API_KEY=your-key pnpm ai:smoke
```

Run `pnpm dev` and open `http://localhost:4173`. AI and music credentials are
entered in Settings and remain in the browser's IndexedDB.

The Settings panel is opened from the gear in the NOW card. Its values,
favorites, caches, and future recommendation state are stored locally in
IndexedDB. AI keys must be entered in the app and must never be placed in Vite
or Tauri build variables.

For a DeepSeek compatibility check, set `RESONARA_AI_API_KEY` only in the
process environment. The smoke script defaults to
`https://api.deepseek.com` and `deepseek-flash`; override them with
`RESONARA_AI_BASE_URL` and `RESONARA_AI_MODEL` when needed.

## Product scope

This is the final recommendation scope, not a staged feature subset:

- NOW recommendations grounded in long-term taste, local time, weather, and the selected listening intent.
- Six one-tap listening intents, with `Use my current environment` selected by default.
- Daily DISCOVER editions with exactly four cards whose imagery comes from recommended tracks and whose titles are generated.
- A global music player with a wide cover card, expandable queue, and transport controls.
- Context feedback is learned into the single long-term profile. Temperature and humidity do not use a separate learning system.

The product is frontend-only and does not use a Resonara backend, account
system, cloud sync, or PostgreSQL. It does not have V1/V2 feature tiers.

## References

Only the materials under `Reference/Recommend - Api` and `Reference/Recommend - Music player` are used for this feature.

The supplied Shoka player was used as an interaction reference. No Shoka image assets are distributed in the current build.
