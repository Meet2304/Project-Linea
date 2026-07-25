# Linea — website

The marketing site for [Linea](../README.md). One page, built with Next.js
(App Router) and Tailwind v4.

```bash
bun install
bun run dev        # http://localhost:3000
bun run build
```

## What's here

| Path                       |                                                                           |
| -------------------------- | ------------------------------------------------------------------------- |
| `app/page.tsx`             | Composes the page and reads the latest GitHub release at render time      |
| `app/globals.css`          | The design tokens, ported from the app's `src/renderer/assets/tokens.css` |
| `app/api/release/route.ts` | Cached proxy for the GitHub Releases API                                  |
| `components/field/`        | The live cymatics engine and its React wrapper                            |
| `components/demo/`         | The interactive overlay replica                                           |
| `components/features/`     | The sticky scroller and its four acts                                     |
| `lib/palettes.ts`          | Named plates (patterns) and duotone palettes                              |

## The two things worth knowing

**The fields are real.** Every pattern on the page is a Chladni-plate
simulation solved per pixel and run through an 8×8 ordered dither
(`components/field/cymatics-live.ts`). None of it is an image. Each instance
parks its `requestAnimationFrame` loop when it scrolls out of view or the tab
is hidden, and renders a single still frame under
`prefers-reduced-motion: reduce`.

**The demo is the real UI.** `components/demo/` is a faithful rebuild of the
Electron overlay — same DOM shape, same class semantics, same hover
choreography, same lyric scheduler (one timer armed at the next boundary, none
while paused), same per-track jewel accent. The token values in `globals.css`
and the thumbnail parameters in `cymatic-thumb.ts` are vendored from the app.
**If the app's design changes, change them here too**; the two are meant to be
comparable side by side.

Lyrics in the demo are original writing, not real song lyrics — see the note
at the top of `components/demo/lyrics.ts`.

## Downloads

`getRelease()` in `app/page.tsx` resolves the newest `.exe` and `.dmg` from
GitHub Releases. Every failure path returns `{ tag: null }`, which renders
"Build from source" instead of a dead link — this is the current state, since
no release has been published yet. Linux visitors always get that fallback:
`electron-builder.yml` has no Linux target.

Set `GITHUB_TOKEN` to raise the API rate limit. It is optional.

## Deploy

Vercel, with **Root Directory** set to `website`.
