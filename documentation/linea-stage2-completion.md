# Linea — Stage 2 Completion Record

**Status:** Complete  
**Completed:** 2026-07-21 06:37:58 +05:30 (commit `6f10db9`)  
**Verified:** 2026-07-21 — `npm test` (11/11 pass), `npm run typecheck` (pass), `npm run lint` (pass)  
**Application path:** `Linea/` (within `Project-Linea` repository)  
**Build guide:** [linea-stage2-features.md](./linea-stage2-features.md)  
**Branch:** `02_Features`

---

## Summary

Stage 2 delivered the feature core of Linea: Spotify OAuth (Authorization Code + PKCE) via the system browser, encrypted refresh-token storage, a main-process now-playing poll that pushes updates to the renderer, LRCLIB synced lyrics with local disk cache and interpolated line sync, and a settings panel (opacity / font size) persisted separately from secrets.

Stage 1’s main / preload / renderer split and “pure logic first” testing pattern were preserved and extended.

---

## Timeline

| Milestone | Date / time (local, +05:30) | Notes |
|---|---|---|
| Stage 2 features guide written | 2026-06-18 | `documentation/linea-stage2-features.md` |
| Phase 5 modules started (uncommitted) | 2026-06-18 | `spotifyAuth`, `loopbackServer`, `tokenStore`, PKCE tests |
| Stage 2 implemented end-to-end | 2026-07-21 | Phases 5–8 wired; overlay UI |
| **Stage 2 committed & pushed** | **2026-07-21 06:37:58** | `6f10db9` on `02_Features` → `origin/02_Features` |

---

## Exit checklist (Stage 2)

All criteria from the features guide are met in code:

- [x] Spotify login via system browser (`shell.openExternal`) with loopback redirect on `127.0.0.1:8888`
- [x] Refresh token encrypted with `safeStorage` in `auth.dat`; auth state survives restart
- [x] Now-playing polled every 2s; renderer updated via push IPC (`send` / `on`)
- [x] 204 / nothing-playing handled without treating idle as an API failure
- [x] Access token refreshed proactively (~30s before expiry)
- [x] Lyrics fetched once per track change from LRCLIB, cached under `lyrics-cache/`
- [x] LRC parse + current-line lookup in `src/shared/`; position interpolated in the renderer
- [x] Overlay shows current line plus dimmed neighbors
- [x] Opacity and font size prefs in `prefs.json`, clamped on read/write
- [x] Vitest coverage for PKCE helpers, LRC parsing, and prefs clamping (`npm test` — 11 cases)

**Manual verification still required on each machine:** set `MAIN_VITE_SPOTIFY_CLIENT_ID` in `Linea/.env`, register redirect URI `http://127.0.0.1:8888/callback` in the Spotify Dashboard, then run `npm run dev` and complete Connect Spotify while music plays.

---

## Technology choices

| Area | Choice | Rationale |
|---|---|---|
| Spotify auth | Authorization Code + PKCE | No client secret in a distributed desktop app |
| Client ID delivery | `MAIN_VITE_SPOTIFY_CLIENT_ID` via electron-vite env | Main-process env prefix; `.env` gitignored; `.env.example` committed |
| Redirect | `http://127.0.0.1:8888/callback` | Loopback catcher; Spotify allows `http` on `127.0.0.1` |
| Token storage | Electron `safeStorage` → `auth.dat` | OS-backed encryption (DPAPI / Keychain) |
| Now-playing | Poll Spotify Web API every 2s | Simple live sync without WebSocket complexity |
| Lyrics | LRCLIB `get` + LRC parse | Free, no auth; synced timestamps |
| Prefs | Plain JSON `prefs.json` | Non-secret; kept separate from `auth.dat` |
| Tests | Vitest (`npm test`) | Same runner as Stage 1; pure modules only |

---

## Implementation choices (vs. Stage 2 reference)

Intentional deviations or refinements during the build:

| Topic | Features guide reference | Implemented |
|---|---|---|
| Client ID env | `process.env.SPOTIFY_CLIENT_ID` | **`import.meta.env.MAIN_VITE_SPOTIFY_CLIENT_ID`** — electron-vite main-process convention; see `Linea/.env.example` |
| Default window size | Stage 1 size (320×160) | **380×240** — room for status, lyrics trio, and settings controls |
| Nothing playing (204) | Poll returns early (no renderer notify) | **Sends `null` now-playing** and clears lyrics so the UI can show idle state |
| Empty lyrics cache | Guide writes whatever LRCLIB returns | **Only cache non-empty lines** — avoids sticky “no lyrics” after a transient miss |
| Poll errors | Not specified | **`try/catch` per tick** — one failure does not stop the interval |
| Token expiry on login | Set on refresh path | **Also set on initial code exchange** |
| Spotify / LRCLIB JSON | Untyped `response.json()` | **Typed response interfaces** — no `any` |
| Overlay UI | Partial snippets (lyric + opacity) | **Full HTML shell**: Connect/Disconnect, click-through, neighbors, opacity + font sliders |
| `tsconfig.web.json` | Not updated in guide | **Includes `src/shared/**/*`** so the renderer can import lyrics helpers |
| Package scripts | Doc often says `bun test` | **`npm test` / `npm run typecheck` / `npm run lint`** verified; Bun lockfile still present |

---

## IPC surface (as built)

| Channel | Shape | Purpose |
|---|---|---|
| `linea:spotify-login` | `invoke` / `handle` | Start PKCE login |
| `linea:spotify-logout` | `invoke` / `handle` | Clear tokens + UI state |
| `linea:spotify-auth-state` | `invoke` / `handle` | Connected? (memory or stored refresh) |
| `linea:now-playing` | `send` / `on` | Push `NowPlaying \| null` |
| `linea:lyrics-update` | `send` / `on` | Push `LyricLine[]` |
| `linea:get-prefs` / `linea:set-prefs` | `invoke` / `handle` | Load / save clamped prefs |
| Stage 1 click-through channels | unchanged | Still present |

Preload exposes these on `window.linea` (`login`, `logout`, `getAuthState`, `onNowPlaying`, `onLyricsUpdate`, `getPrefs`, `setPrefs`, plus Stage 1 APIs).

---

## File tree (Stage 2 deliverable)

```
Linea/
├── .env.example                 # MAIN_VITE_SPOTIFY_CLIENT_ID
├── src/
│   ├── env.d.ts
│   ├── main/
│   │   ├── index.ts             # auth + poll + IPC orchestration
│   │   ├── clickThrough.ts      # Stage 1
│   │   ├── config.ts
│   │   ├── spotifyAuth.ts
│   │   ├── loopbackServer.ts
│   │   ├── tokenStore.ts
│   │   ├── spotifyPlayer.ts
│   │   ├── lyricsCache.ts
│   │   └── prefs.ts
│   ├── preload/index.ts
│   ├── shared/
│   │   ├── ipcChannels.ts
│   │   ├── types.ts             # NowPlaying, Prefs
│   │   └── lyrics.ts            # parseLrc, getCurrentLineIndex, estimatePositionMs
│   └── renderer/
│       ├── index.html
│       ├── assets/main.css
│       └── src/renderer.ts
└── tests/
    ├── clickThrough.test.ts
    ├── spotifyAuth.test.ts
    ├── lyrics.test.ts
    └── prefs.test.ts
```

User-data files at runtime (not in repo): `auth.dat`, `prefs.json`, `lyrics-cache/<trackId>.json`.

---

## Developer setup (required for live auth)

1. Spotify Developer Dashboard → create app → Client ID only (no secret).
2. Redirect URI **exactly**: `http://127.0.0.1:8888/callback`  
   (forward slashes; `127.0.0.1`, not `localhost`).
3. Copy `Linea/.env.example` → `Linea/.env` and set `MAIN_VITE_SPOTIFY_CLIENT_ID`.
4. From `Linea/`: `npm run dev` → **Connect Spotify** → play a track.

---

## Known limitations (acceptable for Stage 2)

- Click-through button label still does not sync when toggled via the global shortcut (carried from Stage 1).
- Stale scaffold assets / `preload/index.d.ts` `window.electron` declaration remain.
- Packaging / code signing / auto-update deferred to Stage 3.
- Not every Spotify track has LRCLIB synced lyrics — UI shows “No synced lyrics for this track.”
- Spotify Development Mode account / Premium constraints may apply depending on dashboard app status.
- End-to-end Spotify login is machine-specific; CI covers unit tests only.

---

## Architectural notes for Stage 3

Stage 3 assumed this feature set was stable and delivered testing, packaging, and auto-update — see [linea-stage3-completion.md](./linea-stage3-completion.md).

Remaining optional cleanup (not required for Stage 2 or 3 exit):

1. Unused scaffold CSS / `window.electron` declarations
2. Click-through button label sync when the global shortcut fires

---

## References

- [Stage 2 build guide](./linea-stage2-features.md)
- [Stage 1 completion record](./linea-stage1-completion.md)
- [Spotify Web API — Authorization Code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [LRCLIB API](https://lrclib.net/docs)
- [Electron `safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage)

---

## Sign-off

| Field | Value |
|---|---|
| Stage | 2 — Features (Phases 5–8) |
| Result | **Complete** |
| Recorded | 2026-07-21 06:37:58 +05:30 |
| Commit | `6f10db9` |
| Next stage | Stage 3 — **Complete** ([linea-stage3-completion.md](./linea-stage3-completion.md)) |
