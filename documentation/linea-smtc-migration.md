# Linea — SMTC Playback Source (Windows)

**Status:** Historical proposal; superseded by the approved plan and [implementation record](./linea-smtc-implementation.md)
**Written:** 2026-09-01  
**Application path:** `Linea/` (within `Project-Linea`)  
**Shipped version when written:** `0.1.6` (`Linea/package.json`)
**Code snapshot this spec was checked against:** `4fede41` (playback-failure surfacing) on top of the v0.1.6 line; `origin/main` already contains that work via PR #35  
**Audience:** implementation handoff  
**Related:** [Stage 2 completion](./linea-stage2-completion.md) (Spotify OAuth as built), [Stage 3 completion](./linea-stage3-completion.md) (packaging; Extended Quota left optional), [README](../README.md) Development Mode section

---

## Problem

Linea is an Electron desktop lyrics overlay. Today it **only** works after Spotify OAuth (Authorization Code + PKCE) against a single Spotify app Client ID baked in at build time (`MAIN_VITE_SPOTIFY_CLIENT_ID` / GitHub secret `SPOTIFY_CLIENT_ID`).

That Spotify app is stuck in **Development Mode**. As of Spotify’s February 2026 rules the cap is **5 authenticated users**, added by hand in the Developer Dashboard. Anyone else can finish “Connect Spotify,” then every Web API call returns `403` (`not registered in the developer dashboard`). Linea already maps that to `PlayerErrorReason: 'not_registered'` (`Linea/src/main/spotifyClient.ts`, `Linea/src/shared/types.ts`).

Spotify will not grant **Extended Quota Mode** without a registered organization and ~250k monthly active users on *their* API. Development Mode makes that number unreachable. A waitlist cannot manufacture MAU; rotating dashboard emails still maxes out at five live users. There is no code-level bypass of the allowlist.

The overlay does not need Spotify’s servers. It sits on the same PC as the player. Windows already exposes the current media session via **SMTC** (`GlobalSystemMediaTransportControlsSessionManager`): title, artist, album, duration, position, playing/paused, and play / pause / next / previous / seek. Lyrics already come from lrclib with a NetEase fallback (`Linea/src/main/lyricsCache.ts`), keyed off title + artist + duration — not off a Spotify track ID.

**Goal:** Ship a new Linea version that is **not dependent on Spotify**. On launch it should follow whatever Windows reports as playing, fetch lyrics for that song, and drop Spotify-only features that cannot work on a generic session.

This is a **Windows-first** cut. The release workflow also builds macOS (`.github/workflows/release.yml`, `Linea/electron-builder.yml`). Do not leave macOS calling dead Spotify code. Prefer a clear Windows SMTC path plus a non-crashing macOS empty state (“media sessions are Windows-only in this version”) unless a small macOS now-playing stub is cheap. Do **not** keep a hidden Spotify OAuth fallback.

---

## Current architecture (as of this snapshot)

Do not rip the overlay. Replace the playback **source**. The rest of the loop stays.

```
Spotify Web API  →  PlayerState  →  IPC.NOW_PLAYING  →  renderer
                         ↓
              getLyricsForTrack (lrclib → netease)
                         ↓
                   IPC.LYRICS_UPDATE
```

| Layer | Role today |
| --- | --- |
| Poll loop | `Linea/src/main/index.ts` — `pollOnce` / `startPolling`, gated on `hasAuth()` |
| HTTP + token refresh | `spotifyClient.ts` → `https://api.spotify.com` |
| Mapping + transport | `spotifyPlayer.ts` (`/v1/me/player`, play/pause/next/prev/seek/shuffle/repeat, like) |
| OAuth | `spotifyAuth.ts`, `loopbackServer.ts` (`127.0.0.1:8888/callback`), `tokenStore.ts`, `config.ts` |
| Lyrics | `lyricsCache.ts` → `lyrics/chain.ts` → `lrclib.ts` / `netease.ts`; matching in `lyrics/match.ts` |
| Types / IPC | `shared/types.ts`, `shared/ipcChannels.ts`, `preload/index.ts` |
| UI | `renderer/index.html`, `playerUi.ts`, `renderer.ts`, `settingsUi.ts` |
| Poll cadence | `shared/pollPolicy.ts` — **returns `null` when `authed` is false** |

`PlayerState` today (`shared/types.ts`):

```ts
isPlaying, trackId, trackName, artistName, albumName,
durationMs, progressMs, fetchedAt,
shuffle, repeat, liked, deviceActive
```

`PlayerCommand` today: `play` | `pause` | `next` | `previous` | `seek` | `shuffle` | `repeat`.

Lyrics lookup (`getLyricsForTrack`) already queries providers with `trackName`, `artistName`, `albumName`, `durationSec`. The Spotify ID is used only as a **cache filename** and as `hasTrackChanged` identity.

---

## Constraints the new source must not break

These are load-bearing in the current tree. Missing any of them will look like “SMTC works but lyrics never appear.”

1. **`pollPolicy.nextPollDelay` returns `null` when `authed` is false.** Polling must run whenever the app is open, not after login. Rewrite `PollContext` (drop `authed`, or treat SMTC as always “ready”). Update `Linea/tests/pollPolicy.test.ts`, which currently asserts the stop-when-unauthenticated behaviour.

2. **`lyricsCache.ts` requires `trackId` matching `/^[A-Za-z0-9]{1,64}$/`.** That regex exists because Spotify IDs become filenames. SMTC has no Spotify ID. If `trackId` is missing or contains spaces/`:`/`/`, lookup returns `{ lines: [], status: 'none' }` and never hits the network. Synthesize a stable, filesystem-safe cache key from normalized `artist + title + duration` (a short hash is fine). Keep the path-traversal guard.

3. **`hasTrackChanged` compares `trackId`.** Identity must be the SMTC identity (or the synthetic key) so a title/artist change still refetches lyrics. `refreshLyrics` in `index.ts` is skipped when `!state.trackId`.

4. **YouTube-style titles** (`Song - Artist (Official Video)`) will miss lrclib more often. Reuse `normalizeName` in `lyrics/match.ts`. Optional light cleanup of `(Official Video)` / `VEVO` / `Lyric Video` tails is in scope if it stays conservative — wrong lyrics are worse than none. The match module already rejects karaoke/cover/remix traps.

5. **Electron main-thread freeze.** Some SMTC Node bindings lock the UI if they run on the main process. Use a worker, a stdio sidecar, or a library documented as Electron-safe. Packaged `electron-builder` Windows builds must include the native addon or sidecar (`Linea/electron-builder.yml` `files` / extraResources).

---

## What to remove

Spotify-only stack — delete, do not leave dormant.

| Area | Files / symbols |
| --- | --- |
| OAuth / tokens | `spotifyAuth.ts`, `loopbackServer.ts`, `tokenStore.ts`, `spotifyClient.ts`, `config.ts` (`SPOTIFY_*`), `Linea/.env.example`, CI env `MAIN_VITE_SPOTIFY_CLIENT_ID` in `.github/workflows/release.yml` |
| Player API | `spotifyPlayer.ts` |
| Tests | `tests/spotifyAuth.test.ts`, `spotifyClient.test.ts`, `spotifyPlayer.test.ts`, `tokenStore.test.ts` |
| IPC | `SPOTIFY_LOGIN`, `SPOTIFY_LOGOUT`, `SPOTIFY_AUTH_STATE`, `TOGGLE_LIKE` |
| Preload / types | `login`, `logout`, `getAuthState`, `toggleLike` in `preload/index.ts` and `linea.d.ts` |
| UI | `#connect-view` / “Connect Spotify”; `#set-disconnect` / “Disconnect Spotify”; shuffle and repeat buttons (`#btn-shuffle`, `#btn-repeat`); like (IPC only — no dedicated like button in HTML today); Premium / not-registered / reconnect toasts |
| Types | `shuffle`, `repeat`, `liked`, `deviceActive` on `PlayerState`; `RepeatMode`; commands `shuffle` / `repeat`; error reasons `premium_required`, `not_registered`, `auth_expired`, `insufficient_scope` |
| Main process extras | `likedCache`, `loginToSpotify` / `logoutFromSpotify`, `updateLikedState`, `scopeLimited` / legacy currently-playing fallback, `PERMANENT_POLL_FAILURES` tied to Spotify auth |

Idle copy to change: `#track-artist` and `playerUi.ts` default **“Play a song on Spotify”** → something source-agnostic (“Play a song”).

---

## What to keep

- Overlay chrome: pin, click-through, tray, summon shortcut, themes, lyrics size, timestamps, cymatics thumb, window bounds, auto-update.
- Lyrics chain + fuzzy match + disk cache (with a new cache key scheme).
- Lyric scheduler / interpolated line sync in the renderer.
- Seek bar + play / pause / previous / next, if SMTC supports them on that session.
- Existing empty lyrics states (`none` vs `unreachable`).

Transport **to keep**, driven through SMTC not `api.spotify.com`: `play`, `pause`, `previous`, `next`, `seek`.

---

## Solution

Replace the Spotify poll with a **Windows SMTC session reader** in the Electron main process (or a worker/sidecar).

On each tick or session event:

1. Read the current media session. If several exist, prefer a plausible music session; if ambiguous, last-updated / the session Windows treats as “now playing” is enough for v1. No session-picker UI.
2. Map to a slimmer `PlayerState`: `isPlaying`, synthetic `trackId`, `trackName`, `artistName`, `albumName`, `durationMs`, `progressMs`, `fetchedAt`.
3. Push `NOW_PLAYING` as today (`null` when nothing is playing → idle overlay).
4. On track identity change, call the existing lyrics chain with title, artist, album, duration.
5. Map play / pause / next / previous / seek to SMTC commands. Optimistic UI + a short follow-up read is fine (today’s `schedulePoll(400)` after a command).

**Empty states:** no session → idle overlay, not a login wall. Delete `#connect-view`. The app opens straight into `#player-view`. Update e2e `tests/e2e/app.spec.ts` (“shows either the connect view or the player view”) accordingly.

**Candidate libraries** (evaluate Electron + packaged-app fit; do not treat this list as a mandate): `windows-media-sessions` (stdio .NET sidecar), `node-windows-smtc-monitor` (napi-rs; reportedly needs a worker in Electron), or a small in-repo WinRT helper. SMTC is Win10 1809+.

**macOS / Linux:** Linux is out of scope. macOS must still **compile, launch, and show the overlay**. If there is no session source, show the idle player with a one-line hint that now-playing follows Windows media sessions in this version — not a crash, not a Spotify login.

**Copy to update in the same change** so the shipped product does not still claim Spotify-only:

- `Linea/package.json` `"description"`
- README “Nothing playing after connecting” / Development Mode section
- Website hero / download CTA / under-the-hood copy (`website/components/showcase/Showcase.tsx`, `Hero.tsx`, `DownloadCTA.tsx`, `UnderTheHood.tsx`, `app/layout.tsx`) — Linea becomes a generic lyrics overlay; keep “Not affiliated with Spotify AB” if Spotify is still mentioned as one possible player

**Version:** bump `Linea/package.json` as part of the implementation (currently `0.1.6`).

---

## Tests

- Delete or fully replace Spotify unit tests listed above.
- Add tests for SMTC → `PlayerState` mapping (mocked session), synthetic cache key (including rejection of unsafe strings), `pollPolicy` without auth, and the stripped `PlayerCommand` union.
- E2e must not assume Connect Spotify. The connect view going away is the assertion.

---

## Out of scope

- Restoring Spotify OAuth, allowlists, or Extended Quota applications
- Fake MAU / waitlist-as-quota
- Apple Music MusicKit / unofficial lyric endpoints
- Perfect YouTube title parsing
- Session picker UI
- Shuffle, repeat, like, device transfer, Premium gating
- Using unofficial Spotify protocols (librespot, Spicetify) as the playback source

---

## Done when

A Windows user installs Linea with **no Spotify developer setup**, plays a track in the Spotify **desktop** app (and ideally YouTube Music / Amazon Music if they publish SMTC), and the overlay shows title/artist and synced lyrics, with play/pause/skip/seek and **no** shuffle/repeat/like/Connect Spotify.

---

## Suggested implementation order

1. Types + IPC + poll policy (auth-free) + synthetic lyrics cache key, with tests green against mocks.
2. SMTC reader module, isolated and fetch-mocked / session-mocked.
3. Wire `index.ts` poll loop; delete Spotify modules; app opens on player view.
4. Strip renderer chrome (connect, disconnect, shuffle, repeat); retarget transport IPC.
5. Packaging: native/sidecar on Windows installer; macOS still launches.
6. Copy (app + README + site) and version bump.
7. Manual verify: Spotify desktop, a second SMTC source if available, idle (nothing playing), seek + skip.
