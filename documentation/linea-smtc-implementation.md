# Windows media migration: implementation and acceptance

Status: implemented locally on `codex/smtc-migration`; **not published**.
Version: `0.2.0-beta.1`. Validation date: 2026-09-06.

The worktree `../Project-Linea-smtc` starts at `ae082fd`. The four tracked UI
changes were carried over; applicable close-button styling remains. The original
checkout and its untracked `PlAyyy/` prototype were left unchanged.

The [original proposal](./linea-smtc-migration.md) is historical reference.
The approved implementation retains shuffle and repeat when the session reports
both support and current state, and prefers actively playing music.

## What ships

One statically linked C++/WinRT executable is bundled outside `app.asar`.
It reads local Windows sessions and handles transport commands through private,
versioned UTF-8 JSON lines. It uses the Windows SDK JSON APIs and adds no npm
dependency, Electron addon, .NET runtime, or external executable download.

TypeScript owns stable session selection, source state, clock mapping, lyrics
lookup and cache identity. Commands carry the displayed session and track
identity; the helper additionally checks the media revision and fresh metadata.
Unavailable controls are disabled with explanations; shuffle/repeat are hidden
when their support or state is unknown.

The bridge coalesces events, reconciles about every two seconds while playing
and ten seconds when idle, bounds requests to five seconds, and restarts after
1, 5, then 30 seconds. Resume reacquires sessions. Pipe closure, normal shutdown,
and parent termination stop the helper. One failed or closing session does not
suppress other usable sessions.

The renderer starts directly in the overlay and recovers complete, ordered state
after startup or reload. Windows timestamps, offsets, playback rate, and stable
anchors drive progress and the one-timer lyric scheduler. Invalid timing leaves
metadata and matched lyrics visible without simulated progress or highlighting.

Lyrics retain the existing providers and wrong-recording safeguards. New cache
keys are versioned SHA-256 hashes of conservatively normalized metadata and
duration. Old caches and preferences remain. Obsolete Windows `auth.dat` is
removed only after the bridge initializes successfully, without decrypting it.

OAuth, login/logout, tokens, Spotify API calls, library likes, and remote-device
control are removed. Session picking and macOS playback are deferred. macOS
compiles with an explicit unsupported-playback state.

## Validation completed locally

- Both application TypeScript checks, ESLint error checks, and **165 unit tests across 18 files**.
- **14 Electron UI tests** covering startup, state recovery, unavailable capabilities,
  invalid timing, stale events, rejected commands, replacement-track races, and
  existing overlay interactions.
- Windows x64 native compilation with MSVC 14.41 / Windows SDK 10.0.22000 and
  an NSIS installer build with the helper outside the application archive.
- Live Spotify desktop discovery, metadata, timeline, play/pause, seek, next/previous track changes, and
  advertised shuffle/repeat operations using the **packaged helper**. This first
  milestone was completed before removing the old playback integration.
- The migrated overlay displayed 43 synced lyric lines for a live Spotify song,
  a valid clock, and no observed renderer errors during the bounded observation.
- A subsequent live launch followed a second active session containing video metadata
  while Spotify was paused. Metadata, progress, disabled skip controls, hidden
  shuffle/repeat and the missing-lyrics state displayed without renderer errors.
  The source reported its playback type as music despite the video content.
  Selection follows the published type; it cannot reliably distinguish such a
  session from music without the deliberately excluded source-name heuristics.
  Commands against this second live source were not exercised.
- A second silent Windows media-player fixture exposed a video session alongside
  Spotify. Its missing timeline and optional controls were represented correctly.
  This is a synthetic source test, not a claim of compatibility with a browser.
- A 30.25-second helper observation with 15 samples measured a roughly 1.3 MiB
  binary and 15.5 MiB peak sampled working set. CPU was below the measurement's
  displayed precision (0.000%); this is a short smoke measurement, not a long-term
  CPU guarantee. The helper also ran from a path with spaces and non-ASCII text.
- Helper processes were checked after shutdown; no test helper remained.
- Website TypeScript checking and a Next.js production build.
- The actual installed electron-updater library was exercised against a simulated
  GitHub feed: legacy stable defaults and the explicit stable policy selected
  `latest.yml`, a newer beta selected `beta.yml`, and older beta/stable versions
  were rejected with downgrades disabled.

The beta installer produces `beta.yml`, with no `latest.yml`, and its embedded
updater config uses the beta channel. Packaging explicitly selects the channel
and fails if it disagrees with the package version. The release workflow creates
Windows-only beta prereleases and never marks them latest. Stable release
routing and macOS manual update behavior remain separate.

Generated installers, screenshots, fetched lyrics, and resource measurements
are ignored build/test outputs and are not committed.

## Required before publishing to friends

These checks require environments or release artifacts not available during this
implementation; they must not be reported as passed:

- Install and launch the real installer on a normal Windows account without
  development tools or extra runtimes, including Windows 10 1809 and Windows 11. The local host used Windows 11.
  Verify the full installed app from a path containing spaces and non-ASCII text.
- Test at least one additional real player/browser source. Verify real music
  alongside browser video, paused launch, closing/reopening players, and rapid
  skips. Confirm each source's actual controls instead of relying on API flags.
- Exercise actual OS sleep/resume and temporary lyric-network loss/recovery.
  Automated source-generation, timeline, failure and retry coverage is in place.
- Observe longer-running helper CPU and memory, UI responsiveness, console
  visibility, clean exit, and cache-hit/event latency under normal use.
- Run the configured macOS CI build/launch checks on a Mac runner.
- Publish a later beta only after approval and verify a real installed
  beta-to-beta update. Confirm a stable Windows installation and stable Mac
  installation remain on their existing release paths. Feed-selection tests do
  not replace an installer download/relaunch test.
- Review unsigned-installer behavior on a clean account as part of normal
  distribution acceptance; no signing credentials were introduced.

The website's labelled beta link targets the future beta release page. The
website and release were not published. Existing stable downloads still follow
the legacy routing and are labelled with their Spotify account limitations.

## Reproduce checks

See [Linea development](../Linea/README.md) for prerequisites and commands.
`scripts/check-smtc.mjs --controls` intentionally controls the current Spotify
session, verifies observable effects, and restores supported settings and playback
state. It restores position only when the original track remains selected.
`scripts/check-live.mjs` uses a temporary profile for the development build.
`scripts/check-smtc-performance.ps1` measures the packaged helper separately.
