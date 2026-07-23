# Linea — Overlay Redesign (as-built)

**Status:** Complete (on branch)
**Updated:** 2026-07-23
**Verified:** `bun run typecheck` (pass), `bun run lint` (pass), `bun run test` (65/65 pass), `bun run test:e2e` (9/9 pass), `bun run build` (pass)
**Application path:** `Linea/` (within `Project-Linea`)
**Branch:** `website/ui-finetuning` (builds on `redesign/minimal-overlay`)
**Commits:** `bc61489`, `5ed999a`, `4e21b7f`, `849c401`, `732dd0a` (+ follow-up polish)

---

## Summary

A ground-up redesign of the overlay toward a **smaller, quieter, lyrics-first** widget, driven by iterative user feedback. The panel is now a compact **landscape** bar that fills a freely resizable window; the lyrics are the hero (fully scrollable, with a jump-to-current control and scroll cues); the transport is a single quiet strip; settings reuse the panel in place; and the cymatics identity moved from a full-panel background into a **small per-track thumbnail** beside the title that evolves while the song plays.

Alongside the visual work, the redesign hardened the app against long-session crashes and fixed several interaction bugs (a startup accelerator crash, a drag region that swallowed clicks/scroll, and window-sizing that left empty space).

A follow-up polish pass on `website/ui-finetuning` refined chrome reveal, accents, timestamps, and focus behavior (see **UI finetuning** below).

---

## What changed (by theme)

### Layout & theme
- **Landscape panel** that fills the window minus a shadow gutter (default window 720×250, freely resizable; min 372×150).
- **Softer, uncut shadow** — the gutter (30px) exceeds the shadow's reach so it fades instead of clipping to a hard rectangle.
- **Near-black dark theme** with a reworked neutral ramp; light theme stays pure white.
- **Settings in place** — the gear swaps the now-playing area for a settings view in the same panel (Esc / ✕ to close); it scrolls rather than resizing the window.

### Lyrics (the hero)
- **Fully scrollable** lyric list. While *following*, the active line stays vertically centered; scrolling away to read ahead/behind reveals a **minimal round jump-to-current button**, which re-locks on tap (or automatically once the current line returns near center).
- **Scroll cues** — a soft fade at whichever edge has more lines signals scrollability.
- **Size presets** replace the old font slider: **Small / Medium / Large** = 13/15/18px paired with **6 / 5 / 3** default visible lines. A live preview line in settings shows the chosen size without leaving the menu; picking a preset sizes the window to that line count.
- **Optional timestamps** — a settings toggle shows LRC times beside each line; off by default.

### Cymatic identity
- Moved from a full-panel field to a **small rounded thumbnail** to the left of the track title.
- Pattern is seeded from the track and hue is a **per-track jewel color**, so each song looks distinct; it **animates/evolves while playing** (a `phase` parameter added to the field engine) and holds a still frame when paused. Respects `prefers-reduced-motion`.
- The same per-track jewel drives `--lyric-accent` so active lyrics, the edge progress hairline, and the seek thumb stay matched.

### Interaction & window sizing
- **Inverted drag model** — the panel is no longer a blanket `-webkit-app-region: drag` surface (which intercepted clicks and scroll). Only the **top bar** and the **connect view** are drag handles; lyrics, controls, and settings are fully interactive.
- **Custom edge/corner resize** — grips sit on the panel's own edge (the OS border is out in the transparent gutter). Corner hints are **pointer-reactive**: only the nearest corner fades in, is magnetically pulled toward the cursor, and pulses once on approach. Corner arcs share `--panel-radius` with the panel.
- **Pin & Close** promoted into the top bar: pin is a pin-icon toggle whose whole icon turns accent when active; close (✕) dismisses the widget. Settings uses the same latched active treatment while open.
- Removed the always-on playing dot, the like button, and the old settings popover.

### Stability
- Null `mainWindow` on close and guard every sender with `isDestroyed()` so poll/lyrics callbacks never touch a dead window.
- Recover in place on `render-process-gone` / `unresponsive`; log uncaught exceptions/rejections in main and renderer instead of dying.
- Removed always-on CSS animation on the transparent, always-on-top window (a GPU-compositing crash risk); animation is now confined to the small thumbnail canvas and hover-only affordances.
- Fixed a **startup crash**: the click-through global shortcut used an invalid accelerator token (`Period`); it now uses `Ctrl+Shift+.` and registration is wrapped so a parse failure can't abort launch.

---

## UI finetuning (`website/ui-finetuning`)

Polish layered on the redesign:

- **Hover chrome** — topbar actions and the transport strip fade in on pointer-inside / focus-within with a felt enter (~280ms) and a snappier leave; the lyrics scrollbar stays hidden until chrome is revealed.
- **Focus-aware hide** — main reports window focus via `WINDOW_FOCUS_CHANGED`; chrome dismisses when the overlay loses focus so it doesn't linger over other work.
- **Controls wash** — readability gradient for the transport lives on `#now-view` (parent), behind the lyrics; on reveal the lyric column fades out at the bottom so timestamps are not overlapped by the wash.
- **Edge progress** — simple opacity crossfade on hover (no vertical motion).
- **Settings plate** — translucent backing when needed, without a hard border at high shell opacity.
- **Panel opacity setting** — **removed from settings for this PR**. `Prefs.opacity` remains on the schema for a future control, but `clampPrefs()` always writes the solid default (`0.95`) so experimental clear-shell work does not ship. Re-adding a polished opacity control is an explicit follow-up.
- **Lyrics show/hide** — **removed entirely** (transport chevron + settings row). Lyrics are always visible; `Prefs.lyricsExpanded` stays on the schema but is locked to `true`.
- **Uniform shell inset** — one shared padding on every side (`12px`, mirrored by `APP_PAD` in the renderer's height math and the `calc(--panel-radius - 12px)` inner radii) so the cymatic thumb sits equidistant from the top and left edges. The old `data-timestamps` left-padding bump (which pushed the thumb inward) was removed.
- **One uniform surface** — flattened the nested "card-in-card" look: the top-bar action cluster no longer sits on a frosted glass plate, and the cymatic thumb and the "Now" jump chip dropped their sunken fills / borders / shadows so nothing reads as a second shade against the panel.
- **Monochrome accent** — the blue (sapphire) brand accent is replaced by `--ink` (**black in light, white in dark**), so pin/settings latched states, seek/segmented fills, and focus rings match the theme. Latched action buttons lost the glow + inset ring for a flat, quiet fill; per-track lyric color (`--lyric-accent`) is unchanged.
- **Lyrics-size preview** — the ambiguous floating `the shape of sound` line became a captioned **Preview** box sampling a recognizable lyric (*"Is this the real life? Is this just fantasy?"*), so the S/M/L control clearly demonstrates font size.

### Window recovery (tray + summon shortcut)
- **Problem:** the window sets `skipTaskbar: true` and had no tray; while **unpinned**, switching apps let it sink behind other windows with no taskbar entry to click it back.
- **System tray icon** — click (or right-click → **Show Linea**) brings the panel back; the menu also offers **Quit Linea**.
- **Global summon shortcut** — `Ctrl/Cmd+Shift+L` foregrounds the panel from anywhere. Both paths call `summonWindow()`, which un-minimizes, shows, briefly forces always-on-top to pop above the focused app, then restores the user's pin preference.

---

## Preferences schema change

`Prefs.fontSize: number` was replaced by `Prefs.lyricsSize: 'small' | 'medium' | 'large'`.

| Field | Before | After |
|---|---|---|
| Lyrics size | `fontSize` (12–28px slider) | `lyricsSize` preset (S/M/L → 13/15/18px, 6/5/3 lines) |
| Timestamps | n/a | `showTimestamps: boolean` (default `false`) |
| Opacity | user slider | schema kept; UI deferred — always locked to `0.95` |

`clampPrefs()` migrates legacy `fontSize`-only files to the default (`medium`); unit tests updated accordingly. `lyricsExpanded` is locked to `true` (collapse UI removed). Other prefs (`theme`, `pinned`) unchanged.

---

## IPC surface (additions)

| Channel | Direction | Purpose |
|---|---|---|
| `RESIZE_WINDOW` | renderer → main | Set window height only (preset sizing) |
| `GET_WINDOW_BOUNDS` | renderer → main | Read current bounds (custom resize) |
| `SET_WINDOW_BOUNDS` | renderer → main | Apply full bounds (edge/corner drag) |
| `CLOSE_WINDOW` | renderer → main | Dismiss the overlay |
| `WINDOW_FOCUS_CHANGED` | main → renderer | Notify focus/blur so chrome can hide |

Existing now-playing / lyrics / prefs / transport channels are unchanged. The removed `SET_LYRICS_EXPANDED` channel (and its preload/`linea.d.ts` binding) went away with the lyrics show/hide feature.

---

## Global shortcuts & tray

| Trigger | Action |
|---|---|
| `Ctrl/Cmd+Shift+.` | Toggle click-through (mouse events pass through the overlay) |
| `Ctrl/Cmd+Shift+L` | Summon the panel to the foreground (recover an unpinned, buried window) |
| Tray icon click / **Show Linea** | Summon the panel |
| Tray **Quit Linea** | Quit the app |

---

## Key files

| File | Role in the redesign |
|---|---|
| `src/renderer/index.html` | Landscape structure: top-bar thumbnail, scrollable lyrics + jump button, in-panel settings, resize grips + corner ticks |
| `src/renderer/assets/tokens.css` | Near-black dark ramp, soft shadow, cymatic/ambient tokens, chrome timing + panel radius; monochrome `--accent` (`--ink`) |
| `src/renderer/assets/main.css` | Fill layout, ghost controls, lyrics scroll + fades, hover chrome, parent wash, segmented size control; uniform inset + flat surfaces + captioned size preview |
| `src/renderer/src/renderer.ts` | Lyrics follow/scroll logic, thumbnail animation, pointer/focus chrome, window sizing, prefs wiring |
| `src/renderer/src/playerUi.ts` | Element map, `LYRICS_PRESETS`, `renderAllLyrics` / `setActiveLyric`, per-track accent |
| `src/renderer/src/settingsUi.ts` | Inline settings view, segmented size control, timestamps toggle |
| `src/renderer/src/cymatics.ts` | `phase` animation parameter, `renderThumb()` |
| `src/main/index.ts` | Window config, custom-resize + close IPC, focus events, crash-recovery + guards; tray + `summonWindow()` + summon shortcut |
| `src/main/prefs.ts` | `lyricsSize` preset + legacy `fontSize` migration; opacity + lyricsExpanded locked |
| `src/shared/types.ts`, `ipcChannels.ts` | `LyricsSize` type, new IPC channels |

---

## Verification

| Check | Result |
|---|---|
| `bun run typecheck` | pass |
| `bun run lint` | pass |
| `bun run test` (Vitest) | 65/65 pass (11 suites) |
| `bun run test:e2e` (Playwright) | 9/9 pass |
| `bun run build` | pass |

E2e window-size and resize assertions were updated for the new dimensions and the renderer-driven resize path.

---

## Known limitations / follow-ups

- The window can be resized in height; a manual height is kept until the next lyrics-size preset change re-sizes to fit.
- The thumbnail renders at CSS pixel size (no devicePixelRatio scaling) and is intentionally softened — crisp enough at ~30px, cheap to animate.
- Manual window size is not persisted across restarts (only the size preset and other prefs are).
- **Panel opacity control** is deferred: shell stays at the solid default until a polished clear→solid slider ships.
- Closing the window (top-bar ✕) still quits the app; the tray keeps the panel reachable only while it is running. "Close hides to tray / background running" is a possible follow-up.
- Signing / notarization and Spotify Extended Quota remain out of scope (see Stage 3 record). Distribution builds (`dist:win` / `dist:mac`) run unsigned today, so downloaders hit SmartScreen / Gatekeeper warnings until certs + a CI signing pipeline are added.

---

## References

- [Stage 3 completion record](./linea-stage3-completion.md)
- [Stage 2 completion record](./linea-stage2-completion.md)
