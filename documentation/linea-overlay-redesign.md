# Linea — Overlay Redesign (as-built)

**Status:** Complete (on branch)
**Updated:** 2026-07-22
**Verified:** `bun run typecheck` (pass), `bun run lint` (pass), `bun run test` (65/65 pass), `bun run test:e2e` (9/9 pass), `bun run build` (pass)
**Application path:** `Linea/` (within `Project-Linea`)
**Branch:** `redesign/minimal-overlay` → draft PR against `02_Features`
**Commits:** `bc61489`, `5ed999a`, `4e21b7f`

---

## Summary

A ground-up redesign of the overlay toward a **smaller, quieter, lyrics-first** widget, driven by iterative user feedback. The panel is now a compact **landscape** bar that fills a freely resizable window; the lyrics are the hero (fully scrollable, with a jump-to-current control and scroll cues); the transport is a single quiet strip; settings reuse the panel in place; and the cymatics identity moved from a full-panel background into a **small per-track thumbnail** beside the title that evolves while the song plays.

Alongside the visual work, the redesign hardened the app against long-session crashes and fixed several interaction bugs (a startup accelerator crash, a drag region that swallowed clicks/scroll, and window-sizing that left empty space).

---

## What changed (by theme)

### Layout & theme
- **Landscape panel** that fills the window minus a shadow gutter (default window 480×264, freely resizable; min 372×150).
- **Softer, uncut shadow** — the gutter (30px) exceeds the shadow's reach so it fades instead of clipping to a hard rectangle.
- **Near-black dark theme** with a reworked neutral ramp; light theme stays pure white.
- **Settings in place** — the gear swaps the now-playing area for a settings view in the same panel (Esc / ✕ to close); it scrolls rather than resizing the window.

### Lyrics (the hero)
- **Fully scrollable** lyric list. While *following*, the active line stays vertically centered; scrolling away to read ahead/behind reveals a **minimal round jump-to-current button**, which re-locks on tap (or automatically once the current line returns near center).
- **Scroll cues** — a soft fade at whichever edge has more lines signals scrollability.
- **Size presets** replace the old font slider: **Small / Medium / Large** = 13/15/18px paired with **6 / 4 / 3** default visible lines. A live preview line in settings shows the chosen size without leaving the menu; picking a preset sizes the window to that line count.

### Cymatic identity
- Moved from a full-panel field to a **small rounded thumbnail** to the left of the track title.
- Pattern is seeded from the track and hue is a **per-track jewel color**, so each song looks distinct; it **animates/evolves while playing** (a `phase` parameter added to the field engine) and holds a still frame when paused. Respects `prefers-reduced-motion`.

### Interaction & window sizing
- **Inverted drag model** — the panel is no longer a blanket `-webkit-app-region: drag` surface (which intercepted clicks and scroll and made the lyrics toggle flaky). Only the **top bar** and the **connect view** are drag handles; lyrics, controls, and settings are fully interactive.
- **Custom edge/corner resize** — grips sit on the panel's own edge (the OS border is out in the transparent gutter). Corner hints are **pointer-reactive**: only the nearest corner fades in, is magnetically pulled toward the cursor, and pulses once on approach.
- **Collapse hugs the chrome** — turning lyrics off measures after layout and shrinks the window to fit (no retained height / empty gap).
- **Pin & Close** promoted into the top bar: pin is a pin-icon toggle whose whole icon turns accent when active; close (✕) dismisses the widget.
- Removed the always-on playing dot, the like button, and the old settings popover.

### Stability
- Null `mainWindow` on close and guard every sender with `isDestroyed()` so poll/lyrics callbacks never touch a dead window.
- Recover in place on `render-process-gone` / `unresponsive`; log uncaught exceptions/rejections in main and renderer instead of dying.
- Removed always-on CSS animation on the transparent, always-on-top window (a GPU-compositing crash risk); animation is now confined to the small thumbnail canvas and hover-only affordances.
- Fixed a **startup crash**: the click-through global shortcut used an invalid accelerator token (`Period`); it now uses `Ctrl+Shift+.` and registration is wrapped so a parse failure can't abort launch.

---

## Preferences schema change

`Prefs.fontSize: number` was replaced by `Prefs.lyricsSize: 'small' | 'medium' | 'large'`.

| Field | Before | After |
|---|---|---|
| Lyrics size | `fontSize` (12–28px slider) | `lyricsSize` preset (S/M/L → 13/15/18px, 6/4/3 lines) |

`clampPrefs()` migrates legacy `fontSize`-only files to the default (`medium`); unit tests updated accordingly. All other prefs (`opacity`, `theme`, `pinned`, `lyricsExpanded`) unchanged.

---

## IPC surface (additions)

| Channel | Direction | Purpose |
|---|---|---|
| `RESIZE_WINDOW` | renderer → main | Set window height only (collapse/expand, preset sizing) |
| `GET_WINDOW_BOUNDS` | renderer → main | Read current bounds (custom resize) |
| `SET_WINDOW_BOUNDS` | renderer → main | Apply full bounds (edge/corner drag) |
| `CLOSE_WINDOW` | renderer → main | Dismiss the overlay |

Existing now-playing / lyrics / prefs / transport channels are unchanged.

---

## Key files

| File | Role in the redesign |
|---|---|
| `src/renderer/index.html` | Landscape structure: top-bar thumbnail, scrollable lyrics + jump button, in-panel settings, resize grips + corner ticks |
| `src/renderer/assets/tokens.css` | Near-black dark ramp, soft shadow, cymatic/ambient tokens |
| `src/renderer/assets/main.css` | Fill layout, ghost controls, lyrics scroll + fades, segmented size control + live preview, themed scrollbar, resize grips + corner hints |
| `src/renderer/src/renderer.ts` | Lyrics follow/scroll logic, thumbnail animation, corner-proximity hints, window sizing, prefs wiring |
| `src/renderer/src/playerUi.ts` | Element map, `LYRICS_PRESETS`, `renderAllLyrics` / `setActiveLyric` |
| `src/renderer/src/settingsUi.ts` | Inline settings view, segmented size control |
| `src/renderer/src/cymatics.ts` | `phase` animation parameter, `renderThumb()` |
| `src/main/index.ts` | Window config, custom-resize + close IPC, crash-recovery + guards |
| `src/main/prefs.ts` | `lyricsSize` preset + legacy `fontSize` migration |
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

- The window can be resized in height while lyrics are shown; a manual height is kept until the next lyrics/preset toggle re-sizes to fit.
- The thumbnail renders at CSS pixel size (no devicePixelRatio scaling) and is intentionally softened — crisp enough at ~30px, cheap to animate.
- Manual window size is not persisted across restarts (only the size preset and other prefs are).
- Signing / notarization and Spotify Extended Quota remain out of scope (see Stage 3 record).

---

## References

- [Stage 3 completion record](./linea-stage3-completion.md)
- [Stage 2 completion record](./linea-stage2-completion.md)
