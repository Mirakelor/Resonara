# Resonara

Context-aware music recommendations built around the right music for the right moment.

The repository currently contains the finalized visual baseline and Phase 1
of the local-first recommendation foundation. Recommendation, Discover, and
playback content still use explicit mock data. Settings, anonymous provider
connection checks, local contracts, and IndexedDB persistence are implemented;
recommendation retrieval and generation begin in Phase 2.

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
```

The Settings panel is opened from the gear in the NOW card. Its values,
favorites, caches, and future recommendation state are stored locally in
IndexedDB. AI keys must be entered in the app and must never be placed in Vite
or Tauri build variables.

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
