---
name: changelog-release
description: Add a release section to the Linea changelog page (website/app/changelog). Use whenever a new Linea version ships or is being written up — adding a dispatch/letter, attaching the song that was playing, writing stand-in lyric lines, or checking that each section still has its own pattern and colour. Triggers on "add a release to the changelog", "new changelog section", "write up vX.Y.Z", "attach a song to a release".
---

# Adding a release to the changelog

The changelog is at `/changelog`, built from `website/components/changelog/`.
**Everything on the page derives from `releases.ts`.** Adding one object there
creates a screen, updates the opener's counts, extends the scroll rail and
assigns a colour and a plate. Resist adding anything by hand that the data can
produce.

## The files

| File | What it holds |
| --- | --- |
| `releases.ts` | The log itself. One object per release. Newest first. |
| `standins.ts` | Original lyric-shaped lines per track. **Never real lyrics.** |
| `song.ts` | Assigns each song a jewel and a plate figure, without repeats. |
| `Changelog.tsx` | Assembles screens; spells the opener counts. |
| `Dispatch.tsx` | One release screen: plate, letter, panel, corner tuner. |
| `Interlude.tsx` | A run of `kind: 'fix'` releases, collapsed to one screen. |
| `changelog.module.css` | Layout. Every screen is **exactly one viewport**. |

## Procedure

### 1. Add the entry to `releases.ts`

Newest first, at the top of `RELEASES`. Required: `version`, `tag`, `date`,
`dateLong`, `title`, `kind`, `accent`, `lede`, `url`.

`kind` drives everything about emphasis:

- `'launch'` / `'feature'` → a full screen ("a letter"), with a plate, a
  headline, optional `points`, and a music panel if it has a `track`.
- `'fix'` → **one line** inside a shared interlude. Corrections carry no
  `points` and no `headline`. Consecutive fixes merge into a single screen
  automatically via `blocksOf()` in `Changelog.tsx`.

`version` is the poster-sized ghost numeral behind the letter. Keep it short —
`0.2.0`, not `0.2.0-beta.1`. Put the exact tag in `tag`; that is what gets
signed at the bottom of the letter.

`url` must resolve. If the GitHub release is not published yet, point at the
releases index rather than a tag that 404s, and leave a comment to swap it.

### 2. Write the copy — short

The screen already carries a plate, a poster-sized numeral, a song panel and a
headline. The writing earns its place by being the least crowded thing on it.

- `headline` — a few words. The point of the release, stated flat.
- `lede` — **one sentence**, what changed for the reader.
- `note` — one line, first person, why it mattered. This is where the voice
  lives; it is allowed to be dry or funny.
- `points` — **three at the very most**, `h` (2–4 words) + `d` (one sentence).

Anything longer belongs in the GitHub release notes, one click away from every
dispatch. First person throughout — the page exists to sound like someone
shipped it, not like a table of tags.

### 3. Attach a song (optional but preferred)

```ts
track: { key: 'Title — Artist', title: 'Title', artist: 'Artist' }
```

`key` is hashed to pick the colour and the plate, so it must be stable — do
not reword it later or the release changes appearance.

A release with no `track` is valid: it drops the music panel and paints from
its own `accent` with a `radial` plate (the one style no song can hash to, so
a songless release can never wear a tracked one's figure).

### 4. Write stand-in lines in `standins.ts`

**Never put real song lyrics in this repo.** This is a standing rule, not a
per-case judgement. Real words are fetched from lrclib at request time through
`/api/lyrics`, exactly as the desktop app does, and nothing copyrighted is
stored here.

What goes in `standins.ts` is **original writing of your own** — lines about
the release itself, shaped like lyrics, that run while the fetch is in flight
and keep running if lrclib has no synced match. Key it by the same
`track.key`. Follow the house shape: open with `'Waiting on the words'`, then
10–13 short lines about what shipped, `cue(lines, ~1000, 4300)`.

The panel labels itself "Stand-in words — fetching from lrclib" and drops the
footnote the moment real words land. Looping is already handled — `MiniOverlay`
passes `loop: true` to `usePlaybackClock`, which wraps at `durationMs` without
pausing.

### 5. Check the colour and the pattern

`assignSongVisuals()` in `song.ts` guarantees no two sections share a jewel or
a plate figure. It works by walking a song's seed forward until it finds a
free pair, oldest release first. You do not choose a colour — but you do have
to confirm it found one.

Two ceilings to know about:

- **`PLATE_JEWELS` has 9 entries.** The 10th tracked release cannot get a
  unique colour; the walk gives up after 256 steps and repeats one. At that
  point either add a jewel (define it in all three blocks of
  `app/globals.css`: `@theme`, `:root`, and the dark block, plus a `-wash`) or
  accept the repeat deliberately.
- **Songless releases claim colours too.** Their hardcoded `accent` is
  reserved before the walk runs. If you give a songless release a new accent,
  a tracked release may move colour to get out of its way.

Verify after any change:

```bash
cd website && npx next build && npx next start -p 3999 &
curl -s http://localhost:3999/changelog | grep -o '\-\-accent-c:var(--[a-z]*)' | sort | uniq -c
```

Every count must be `1`. A count of `2` means two screens are wearing the same
colour — fix it before shipping.

### 6. Confirm the opener updated itself

The opener spells its own counts from the data (`Changelog.tsx`):

```
{spell(RELEASES.length)} releases. {spell(letters)} of them worth a letter.
```

Never hand-edit those numbers — they went stale exactly once and that is why
they are derived. Just confirm the rendered page moved:

```bash
curl -s http://localhost:3999/changelog | grep -o 'dispatches.\{0,200\}'
```

`NUMBER_WORDS` runs out at twelve; past that it falls back to digits.

### 7. Check the screen still fits one viewport

`.screen` is `height: 100dvh` with mandatory scroll snapping. **A screen must
never grow.** Too many `points`, or a `lede` that turns the corner three
times, pushes content out of reach — the notes disclosure scrolls *inside* the
screen rather than extending it.

Check at 1440px and at 900px (the panel goes inline below 1320px, and the
plate moves and widens below 900px).

### 8. Verify

```bash
cd website
npx tsc --noEmit
npx prettier --check components/changelog app/globals.css
npx next build
```

Then load `/changelog` and confirm, for the new screen:

- the plate is a pattern no other screen is running;
- the corner **tuner** works — hovering the top-right re-forms the plate into
  a different figure, keeping its style and colour (mouse + ≥901px only; it is
  removed under `prefers-reduced-motion`);
- the music panel plays, the lines advance, and it loops at the end;
- the ghost numeral, the stamp date and the signed tag all read correctly.

## Things that will bite you

- **Editing `paramsForSeed` in `cymatic-thumb.ts`.** That module is a vendored
  copy of the desktop app's renderer and is meant to stay pixel-identical to
  it. The changelog's wider palette lives in `song.ts` for that reason. Keep
  changelog-only concerns out of `cymatic-thumb.ts`.
- **Changing a `track.key` after the fact.** It rehashes, and every release
  after it may shuffle colour as the walk re-routes.
- **Adding a 4th point.** The screen cannot grow. Three is the ceiling.
- **A tag URL for an unpublished release.** It 404s. Point at the index.
