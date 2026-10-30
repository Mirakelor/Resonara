# Recommendation visual baseline

## Sources

- Product copy and information architecture from the supplied AI Music Recommendation design.
- The user-supplied NOW and Mood layout screenshots from 2026-10-30.
- `Reference/Recommend - Api/Api` for the Netease music provider base URL.
- `Reference/Recommend - Music player/hexo-theme-shoka-master.zip` for the player, record, needle, queue, and control treatment.

No other reference folder is part of this feature.

## Fixed product rules

- There are no feature tiers. This implementation defines the final recommendation scope.
- `Use my current environment` is selected by default.
- Selecting any of the six intent options immediately requests recommendations. There is no second confirm button.
- `Ignore the environment` is a deliberate alternate mode and changes the recommendation context.
- Temperature, humidity, time, and weather feedback are learned in the single long-term profile. There is no separate temperature/humidity learning subsystem.
- DISCOVER always renders exactly four large image cards in one daily edition.
- Each DISCOVER image is the cover of a track present in the recommendation pool.
- Each DISCOVER title is generated rather than fixed, and the four-card edition changes once per local day.
- Product interface copy is English. Song titles, artists, and lyrics retain their original language.
- Decorative explanation and preview copy that does not help the current action is omitted.

## Screen contract

### NOW

1. Centered, bordered content card on a white page.
2. `YOUR MUSIC MOMENT` eyebrow.
3. “Good afternoon. What music fits this moment?” headline.
4. Context line: time, temperature, humidity, weather.
5. A 16:9 cover randomly selected from the three recommended tracks.
6. AI rationale combining long-term taste with the current context.
7. Three compact recommendation rows with cover, song metadata, and circular play control.
8. Batch feedback using thumbs-up and thumbs-down icons.
9. Selecting any recommendation row opens the player and starts the listening session.
10. The NOW card uses the same maximum width and rounded border as MOOD and DISCOVER.

### MOOD & CONTEXT

1. `What do you need right now?`
2. Six icon-and-label options in a 3×2 grid on desktop and mobile.
3. Six one-tap intents: Feel Good, Energize, Relax, Focus, Comfort, Surprise Me.
4. Environment mode with `Use my current environment` selected on first render.
5. Two stacked environment options separated from the intents by a divider.
6. Selecting an intent immediately updates and scrolls to the recommendation batch.
7. The MOOD container uses the same width and card treatment as the other two sections.

### DISCOVER

1. Exactly four editorial image cards in a 2×2 grid.
2. Track cover imagery with a dark readability veil.
3. AI-generated title at the lower left.
4. Context subtitle beneath the title.
5. All four cards fit inside one desktop or mobile viewport.
6. Editorial explanation and edition metadata are omitted from the visible interface.
7. The four image cards sit inside a rounded outer card matching NOW and MOOD.

### Player

- Compact global player appears after playback starts and remains available while navigating.
- The expanded desktop player is horizontally centered and approximately 1024 px wide.
- Its internal sequence remains the accepted vertical player: wide cover card, track information, controls, then queue.
- The cover is a wide, rounded image card rather than a vinyl record.
- Five transport controls run left to right: restart, previous, play/pause, next, volume.
- Queue contains the current recommendation batch.
- On mobile the expanded player becomes a bottom sheet.
- The wide desktop layout reserves the secondary column for the later dynamic lyrics surface.

## Design tokens

| Token | Value |
| --- | --- |
| Paper | `#ffffff` |
| Soft paper | `#f4f3ef` |
| Ink | `#171815` |
| Soft ink | `#555952` |
| Accent | `#d25f43` |
| Display type | Noto Serif SC, Songti SC, serif |
| UI type | Manrope, Avenir Next, Segoe UI, sans-serif |
| All outer sections | `70rem` maximum |
| Section gap | `1rem` |
| Player width | `64rem` maximum |

## Responsive checkpoints

- 1440 px: NOW, MOOD, and DISCOVER share the same 1120 px outer width and 16 px gaps; four DISCOVER cards fill a 2×2 grid; centered wide player.
- 1024 px: the same hierarchy with adaptive media sizes and no horizontal overflow.
- 768 px: compact header, 3×2 intent grid, 2×2 DISCOVER grid, bottom-sheet player.
- 390 px: all three outer sections share the same 351 px width and 16 px gaps; all four DISCOVER cards remain visible in one viewport.

## Intentional baseline behavior

This milestone uses a mock adapter. Random featured-cover selection, mood selection, environment selection, recommendation refresh, feedback selection, DISCOVER selection, queue selection, player expansion, and playback state are interactive. Real weather, recommendation ranking, AI copy generation, dynamic lyrics, and production playback remain behind the contract.
