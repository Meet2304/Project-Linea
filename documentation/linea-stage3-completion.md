# Linea — Stage 3 Completion Record

**Status:** Complete  
**Completed:** 2026-07-21 08:04:09 +05:30 (implementation verified on `02_Features`)  
**Verified:** 2026-07-21 — `bun run test` (19/19 pass), `bun run test:e2e` (6/6 pass), `bun run typecheck` (pass), `bun run lint` (pass), `bun run dist:win` → `Linea/dist/Linea-0.1.0-setup.exe`  
**Application path:** `Linea/` (within `Project-Linea` repository)  
**Build guide:** [linea-stage3-ship.md](./linea-stage3-ship.md)  
**Branch:** `02_Features`

---

## Summary

Stage 3 shipped Linea as a testable, packagable desktop app: Vitest coverage for network- and Electron-dependent pure modules (`spotifyPlayer`, `tokenStore`), Playwright e2e against the real compiled Electron binary, GitHub Actions CI (unit + e2e) and tag-driven release workflows, `electron-builder` installers (unsigned), and `electron-updater` pointed at GitHub Releases (skipped in dev).

Code signing / notarization and Spotify Extended Quota Mode remain optional Tier-3 extensions — not required for Stage 3 exit.

---

## Timeline

| Milestone                          | Date / time (local, +05:30) | Notes                                                  |
| ---------------------------------- | --------------------------- | ------------------------------------------------------ |
| Stage 3 ship guide written         | 2026-07-21                  | `documentation/linea-stage3-ship.md`                   |
| Phase 9 — Vitest + Playwright + CI | 2026-07-21                  | New unit tests, e2e suite, CI rewrite                  |
| Phase 10 — packaging + auto-update | 2026-07-21                  | `electron-builder.yml`, `updater.ts`, release workflow |
| Local Windows installer produced   | 2026-07-21                  | `bun run dist:win` → `Linea-0.1.0-setup.exe`           |
| **Stage 3 signed off (docs)**      | **2026-07-21 08:04:09**     | Implementation verified; completion record written     |

---

## Exit checklist (Stage 3)

All criteria from the ship guide are met in code / local verification:

- [x] Vitest coverage for `spotifyPlayer` (fetch-mocked) and `tokenStore` (`vi.mock` for electron + fs)
- [x] Playwright e2e: always-on-top, frameless, size, `window.linea` / no `require`, click-through IPC
- [x] GitHub Actions CI: unit job (`ubuntu-latest`) + e2e job (`macos-latest`)
- [x] `bun run dist` / `dist:win` produces installer under `Linea/dist/`
- [x] `package.json` version set to `0.1.0`
- [x] `electron-updater` initialized via `initAutoUpdater()`; guarded by `is.dev`
- [x] Release workflow on `v*` tags builds macOS + Windows and publishes with `GH_TOKEN`
- [x] Signing / notarization documented as optional extension only (not implemented)

**Still required outside the codebase for a real public release:**

1. Repository secret `GH_TOKEN` (PAT with `repo` scope) before the first `v*` tag push
2. Manual smoke of the installed app with Spotify credentials on each target OS
3. (Optional) Apple / Windows signing credentials if distributing beyond a small unsigned audience

---

## Technology choices

| Area               | Choice                                      | Rationale                                                          |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| Unit tests         | Vitest (`bun run test`)                     | Same runner as Stages 1–2; `vitest.config.ts` excludes `tests/e2e` |
| E2e tests          | Playwright `_electron.launch()`             | Real compiled app (`out/main/index.js`); no Spotify API            |
| CI package manager | Bun (`oven-sh/setup-bun@v2`)                | Matches project lockfile (`bun.lock`)                              |
| Packaging          | `electron-builder` + `electron-builder.yml` | Dedicated config; NSIS (Win) / DMG (mac)                           |
| Publish target     | GitHub Releases (`Meet2304/Project-Linea`)  | `electron-updater` reads `latest.yml` from releases                |
| Auto-update        | `electron-updater` in `src/main/updater.ts` | Isolated module; no-op in `is.dev`                                 |
| Version            | `0.1.0`                                     | Semantic starting version for the ship phase                       |
| Signing            | Unsigned (Tier 1/2)                         | Gatekeeper / SmartScreen warnings acceptable for small groups      |

---

## Implementation choices (vs. Stage 3 reference)

Intentional deviations or refinements during the build:

| Topic                | Ship guide reference                   | Implemented                                                                                |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Window size in e2e   | 320×160                                | **380×240** (Stage 2 as-built); DPI-tolerant range on Windows                              |
| Frameless assertion  | `isNormal()` (unreliable)              | **Content bounds == outer bounds** (no title-bar chrome)                                   |
| Click-through state  | Undocumented `isMouseEventsIgnored`    | **`window.linea.getClickThroughState()`** via renderer IPC                                 |
| Click-through button | Generic `page.locator('button')`       | **`#click-through-btn`** (auth button also present)                                        |
| E2e parallelism      | Shared `beforeAll` app                 | **`serial` + `workers: 1`** so shared Electron process is safe                             |
| CI unit command      | `bun test` (Bun native runner)         | **`bun run test`** (Vitest — existing project convention)                                  |
| CI prior job         | Format/lint/typecheck/build single job | **Split unit + e2e** per Stage 3; format/lint remain local scripts                         |
| `appId` / publish    | Placeholders                           | **`com.meet2304.linea`**, owner `Meet2304`                                                 |
| `dev-app-update.yml` | Generic example URL                    | **GitHub provider** aligned with production publish                                        |
| Vitest vs e2e        | Not specified                          | **`vitest.config.ts`** `include: tests/**/*.test.ts` so Playwright specs are not collected |
| Signing extension    | Optional `build/notarize.js`           | **Not added** — entitlements already present from scaffold                                 |

---

## CI / release surface

### `.github/workflows/ci.yml`

| Job            | Runner          | Steps                                                                  |
| -------------- | --------------- | ---------------------------------------------------------------------- |
| Unit tests     | `ubuntu-latest` | `bun install --frozen-lockfile`, typecheck, `bun run test`             |
| Playwright e2e | `macos-latest`  | install, `bun run build`, Playwright chromium deps, `bun run test:e2e` |

Triggers: push / PR to `main`.

### `.github/workflows/release.yml`

| Job           | Runner           | Steps                             |
| ------------- | ---------------- | --------------------------------- |
| Build macOS   | `macos-latest`   | `bun run release` with `GH_TOKEN` |
| Build Windows | `windows-latest` | `bun run release` with `GH_TOKEN` |

Triggers: push of tags matching `v*`.

### Package scripts (new / updated)

| Script                           | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `test:e2e`                       | Playwright                                  |
| `dist` / `dist:mac` / `dist:win` | Build + package for platform                |
| `release`                        | Build + `electron-builder --publish always` |

---

## File tree (Stage 3 deliverable)

```
Project-Linea/
├── .github/workflows/
│   ├── ci.yml                 # unit + e2e
│   └── release.yml            # tag → GitHub Release
├── documentation/
│   ├── linea-stage3-ship.md
│   └── linea-stage3-completion.md
└── Linea/
    ├── electron-builder.yml
    ├── playwright.config.ts
    ├── vitest.config.ts
    ├── package.json           # version 0.1.0; dist / release / test:e2e
    ├── src/main/
    │   ├── index.ts           # calls initAutoUpdater()
    │   └── updater.ts
    └── tests/
        ├── spotifyPlayer.test.ts
        ├── tokenStore.test.ts
        ├── … (Stage 1–2 unit tests)
        └── e2e/app.spec.ts
```

Generated (not committed): `Linea/out/`, `Linea/dist/`, `Linea/test-results/`, `Linea/playwright-report/`.

---

## Release process (as built)

```bash
# From Linea/
# 1. Bump version (keeps tag and package.json in sync)
npm version patch   # or minor / major

# 2. Push commit + tag
git push && git push --tags
```

GitHub Actions builds installers on macOS and Windows runners and uploads them to a GitHub Release. Existing installs check `latest.yml` on launch via `electron-updater`.

Local pre-check before tagging:

```bash
bun run dist        # or dist:win / dist:mac
```

---

## Known limitations (acceptable for Stage 3)

- Builds are **unsigned** — Gatekeeper / SmartScreen warnings on first open are expected.
- First automated publish needs `GH_TOKEN` configured in repo secrets.
- CI e2e runs on `macos-latest` only; Windows packaging is covered by the release workflow and local `dist:win`.
- Click-through button label still does not sync when toggled via the global shortcut (carried from Stage 1).
- Spotify Development Mode 5-user cap unchanged until Extended Quota Mode is requested.
- End-to-end Spotify OAuth remains intentionally out of Playwright scope.

---

## Architectural notes (post–Stage 3)

Linea is feature-complete for the guided curriculum. Sensible next work, if desired:

1. Code signing + notarization (see Stage 3 extension section)
2. Spotify Extended Quota Mode for wider distribution
3. Sync click-through UI when the global shortcut fires
4. Clean leftover scaffold CSS / `window.electron` declarations

Do not treat signing as a blocker for personal or small-group installs.

---

## References

- [Stage 3 ship guide](./linea-stage3-ship.md)
- [Stage 2 completion record](./linea-stage2-completion.md)
- [Stage 1 completion record](./linea-stage1-completion.md)
- [Playwright Electron](https://playwright.dev/docs/api/class-electron)
- [electron-builder](https://www.electron.build/)
- [electron-updater](https://www.electron.build/auto-update)

---

## Sign-off

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| Stage    | 3 — Ship (Phases 9–10)                                              |
| Result   | **Complete**                                                        |
| Recorded | 2026-07-21 08:04:09 +05:30                                          |
| Commit   | Stage 3 ship commit on `02_Features`                                |
| Next     | Optional Tier-3 signing / Extended Quota; or treat Linea as shipped |
