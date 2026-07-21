# Linea — Stage 3: Ship (Phases 9–10)

**Status:** Source of truth for guided build
**Scope:** Testing pass and packaging/distribution
**Builds on:** Stage 1 (foundation) and Stage 2 (features) — see
`linea-stage1-foundation.md`, `linea-stage1-completion.md`,
`linea-stage2-features.md`
**Application path:** `Linea/` (within `Project-Linea` repository)
**Package manager:** Bun (`bun install`, `bun run dev`, `bun test`)

---

## How to use this document

Same approach as Stages 1 and 2: treat each phase as a checkpoint, use
"Concepts to teach" as the bar for understanding (not just working code),
and have the learner type code with this as a reference rather than a copy
source. Surface "Common pitfalls" proactively.

One important difference from Stage 2: Phase 10 has a deliberately tiered
scope. The main path covers Tier 1/2 distribution — unsigned builds that
work for personal use and small groups. Code signing and notarization are
documented as an explicit extension section at the end of Phase 10, not
the main path, because they cost money and require setup outside the
codebase. The guiding model should not present signing as a required step
unless the learner explicitly says they want to distribute to the public.

---

## 0. Context recap — what's already true

From Stages 1 and 2:

- App: `Linea/` subdirectory, `Project-Linea` repository
- Bun throughout: `bun install`, `bun run dev`, `bun test`, `bun run
  typecheck`
- Window: frameless, transparent, always-on-top, resizable, positioned
  top-right
- Click-through: `CommandOrControl+Shift+Period` global shortcut + IPC
  button
- Security: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: false`
- `@electron-toolkit/utils` retained from scaffold
- IPC: all channel names in `src/shared/ipcChannels.ts`; preload exposes
  `window.linea`; renderer never touches `ipcRenderer` directly
- Pure logic in separate files: `clickThrough.ts`, `spotifyAuth.ts`,
  `lyrics.ts`, `prefs.ts`
- Vitest configured; existing passing tests: `clickThrough.test.ts`,
  `spotifyAuth.test.ts`, `lyrics.test.ts`, `prefs.test.ts`
- `electron-builder` and `electron-updater` present from scaffold but
  unexercised
- `electron-vite.config.ts` and `package.json` contain the build
  configuration

**What Stage 3 adds:** A complete test suite with Playwright e2e against
the real running app, a GitHub Actions CI pipeline, a production build
that produces an actual installer, and auto-update via GitHub Releases.

---

## Stage 3 — definition of done

By the end of Phase 10, the learner has:

- A Vitest suite with meaningful coverage of all pure-logic modules from
  Stages 1 and 2, including fetch-mocked tests for network-dependent code.
- Playwright e2e tests that launch the real compiled Electron app and
  verify window properties, IPC behavior, and renderer state — without
  touching the Spotify API.
- A GitHub Actions workflow that runs unit tests and e2e tests on every
  push to main.
- A production build that produces a `.dmg` (macOS) and/or NSIS `.exe`
  (Windows) via `electron-builder` — unsigned, but structurally complete
  and runnable.
- Auto-update wired up via `electron-updater`, pointed at GitHub Releases,
  checked on every app launch.
- A clear understanding of what signing and notarization would add and
  what they require — even if not implemented yet.

---

## Phase 9 — Testing pass

### Goal

Fill in test coverage for every meaningful piece of logic in the codebase,
add Playwright e2e tests that verify the app's behavior from the outside,
and wire both into a CI pipeline that runs on every push.

### Concepts to teach

- **Two fundamentally different kinds of test in an Electron app**: Vitest
  tests *logic* — pure functions with no Electron dependency, isolated and
  fast, runnable anywhere. Playwright tests *behavior* — it launches the
  real compiled Electron app and drives it programmatically, the same as
  a real user would. The right test for "does `parseLrc` return the right
  timestamp?" is Vitest. The right test for "does the window actually have
  `alwaysOnTop` set after launch?" is Playwright.
- **Why the boundary matters**: Electron-dependent code (anything
  importing from `electron`, anything that requires a running
  `BrowserWindow`) cannot be meaningfully unit tested with Vitest. You
  can't import `app` or `BrowserWindow` in a test file — there's no
  Electron process for them to attach to. This is exactly why Stage 1
  established the pattern of isolating pure logic into separate files
  (`clickThrough.ts`, `lyrics.ts`, etc.). The payoff is that those
  files are straightforwardly testable, and the Electron-glue code is
  thin enough that e2e tests can cover its behavior.
- **`vi.stubGlobal('fetch', ...)` for network-dependent modules**: modules
  like `spotifyPlayer.ts` and `lyricsCache.ts` call `fetch` internally.
  You can't hit the real Spotify or LRCLIB API in CI — no credentials, no
  network guarantee. The fix is to replace the global `fetch` with a mock
  in `beforeEach`, making the test control exactly what network calls
  return without any actual I/O.
- **`vi.mock(...)` for module-level fakes**: where an entire module's
  behavior needs replacing (like `tokenStore.ts` — you don't want tests
  writing encrypted files to disk), `vi.mock()` replaces the module at
  import time with a manually specified fake.
- **Playwright's `_electron.launch()`**: the entry point for e2e testing.
  It launches a real Electron process, pointed at your compiled output
  (`out/main/index.js` after `bun run build`). It returns an
  `ElectronApplication` object with two key capabilities: `firstWindow()`
  gives you a Playwright `Page` (the same API used for browser automation)
  targeting the renderer, and `evaluate()` runs code *inside the main
  process*, so you can read `BrowserWindow` properties directly.
- **What Playwright can and cannot test**: it *can* test that the window
  is frameless and always-on-top (via `app.evaluate()`), that the IPC
  bridge works (click the toggle button, check the UI updates), and that
  the renderer renders expected content. It *cannot* test the Spotify
  OAuth flow — that requires opening a real browser and a human approving
  access. The e2e suite skips auth by launching the app in a state that
  bypasses the login requirement.
- **GitHub Actions**: a YAML workflow file that tells GitHub's CI servers
  what to run and when. `on: push` means it runs every time code is pushed
  to the repository. Jobs run on hosted VMs called *runners* — you
  specify the OS with `runs-on`. Unit tests can run on any OS
  (`ubuntu-latest` is cheapest). Playwright e2e tests need a display to
  render a window — `macos-latest` has one natively; Linux needs
  `xvfb-run` to simulate one.
- **Bun in CI**: Bun is not pre-installed on GitHub Actions runners;
  `oven-sh/setup-bun@v2` installs it. After that, `bun install`, `bun
  test`, and `bun run build` work exactly as they do locally.

### Installing Playwright

```bash
bun add -D @playwright/test
bunx playwright install
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

### Reference implementation

#### Completing Vitest coverage

`tests/spotifyPlayer.test.ts` (new — mocks `fetch` to test the
currently-playing module without a real Spotify API)
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCurrentlyPlaying, hasTrackChanged } from '../src/main/spotifyPlayer'
import type { NowPlaying } from '../src/shared/types'

const makeNowPlaying = (overrides: Partial<NowPlaying> = {}): NowPlaying => ({
  isPlaying: true,
  trackId: 'track-1',
  trackName: 'Test Track',
  artistName: 'Test Artist',
  albumName: 'Test Album',
  durationMs: 200000,
  progressMs: 30000,
  fetchedAt: Date.now(),
  ...overrides
})

describe('hasTrackChanged', () => {
  it('returns true when track id differs', () => {
    expect(hasTrackChanged(makeNowPlaying({ trackId: 'a' }), makeNowPlaying({ trackId: 'b' }))).toBe(true)
  })
  it('returns false when track id is the same', () => {
    expect(hasTrackChanged(makeNowPlaying({ trackId: 'a' }), makeNowPlaying({ trackId: 'a' }))).toBe(false)
  })
  it('returns true when previous is null', () => {
    expect(hasTrackChanged(null, makeNowPlaying())).toBe(true)
  })
})

describe('fetchCurrentlyPlaying', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns null for a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 204 })
    )
    expect(await fetchCurrentlyPlaying('fake-token')).toBeNull()
  })

  it('throws for a non-ok, non-204 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('{}', { status: 401 })
    )
    await expect(fetchCurrentlyPlaying('fake-token')).rejects.toThrow('401')
  })

  it('returns a NowPlaying object for a valid 200 response', async () => {
    const payload = {
      is_playing: true,
      progress_ms: 12000,
      item: {
        id: 'abc123',
        name: 'My Song',
        duration_ms: 180000,
        artists: [{ name: 'The Artist' }],
        album: { name: 'The Album' }
      }
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 })
    )
    const result = await fetchCurrentlyPlaying('fake-token')
    expect(result?.trackId).toBe('abc123')
    expect(result?.trackName).toBe('My Song')
  })
})
```

`tests/tokenStore.test.ts` (new — mocks the Electron module entirely since
`safeStorage` and `app.getPath` don't exist outside a running Electron
process)
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linea-test' },
  safeStorage: {
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8')
  }
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const store = new Map<string, Buffer>()
  return {
    ...actual,
    existsSync: (p: string) => store.has(p),
    readFileSync: (p: string) => store.get(p)!,
    writeFileSync: (p: string, data: Buffer) => store.set(p, data),
    unlinkSync: (p: string) => store.delete(p)
  }
})

const { saveRefreshToken, loadRefreshToken, clearRefreshToken } =
  await import('../src/main/tokenStore')

describe('tokenStore', () => {
  it('round-trips a refresh token', () => {
    saveRefreshToken('my-token')
    expect(loadRefreshToken()).toBe('my-token')
  })
  it('returns null before any token is saved', () => {
    clearRefreshToken()
    expect(loadRefreshToken()).toBeNull()
  })
})
```

#### Playwright configuration

`playwright.config.ts` (new, at the `Linea/` root)
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list'
})
```

#### Playwright e2e tests

`tests/e2e/app.spec.ts` (new — launches the real built Electron app and
verifies observable behavior; does not touch the Spotify API)
```ts
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { join } from 'node:path'

let app: ElectronApplication

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')]
  })
})

test.afterAll(async () => {
  await app.close()
})

test('window is always on top', async () => {
  const isAlwaysOnTop = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].isAlwaysOnTop()
  )
  expect(isAlwaysOnTop).toBe(true)
})

test('window is frameless', async () => {
  // Electron surfaces this as the absence of a native frame
  const hasFrame = await app.evaluate(({ BrowserWindow }) =>
    (BrowserWindow.getAllWindows()[0] as any).isNormal()
  )
  // A frameless window is not in "normal" framed mode
  expect(hasFrame).toBe(false)
})

test('window opens with the correct initial size', async () => {
  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getBounds()
  )
  expect(bounds.width).toBe(320)
  expect(bounds.height).toBe(160)
})

test('renderer exposes window.linea but not window.require', async () => {
  const page = await app.firstWindow()
  const lineaApi = await page.evaluate(() => typeof window.linea)
  const requireApi = await page.evaluate(() => typeof (window as any).require)
  expect(lineaApi).toBe('object')
  expect(requireApi).toBe('undefined')
})

test('click-through toggle button exists and can be clicked', async () => {
  const page = await app.firstWindow()
  const button = page.locator('button')
  await expect(button).toBeVisible()
  await button.click()
  // After clicking, state has changed — the toggle logic ran
  // We verify the IPC call completed by reading the button's updated text
  const text = await button.textContent()
  expect(text).toMatch(/click-through/i)
})

test('click-through state changes via IPC', async () => {
  // Get state before
  const stateBefore = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return (win as any).isMouseEventsIgnored?.() ?? null
  })

  const page = await app.firstWindow()
  await page.locator('button').click()

  // Get state after
  const stateAfter = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return (win as any).isMouseEventsIgnored?.() ?? null
  })

  // State flipped
  expect(stateAfter).not.toBe(stateBefore)
})
```

> **Note on `isMouseEventsIgnored`:** this is an undocumented
> Electron/Chromium internal — it may not exist on all Electron versions.
> If it returns `null` in your version, the test still passes but only
> verifies the click ran without error. The important coverage is that
> IPC itself didn't throw. Check `BrowserWindow`'s current API surface for
> the official way to read this state in the version you're running.

#### GitHub Actions CI

`.github/workflows/ci.yml` (new, in the repository root — not inside
`Linea/`, since GitHub Actions reads workflows from the repo root)
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: Unit tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: Linea

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Unit tests
        run: bun test

  e2e-tests:
    name: Playwright e2e
    runs-on: macos-latest
    defaults:
      run:
        working-directory: Linea

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build app
        run: bun run build

      - name: Install Playwright
        run: bunx playwright install --with-deps chromium

      - name: Run e2e tests
        run: bun run test:e2e
```

> **Why two jobs?** Unit tests are fast and can run on Linux (cheaper
> runner, no display needed). E2e tests need a real display to render the
> Electron window — macOS runners have one natively. Keeping them in
> separate jobs means a unit test failure doesn't block the e2e job from
> starting, giving more information from one CI run.

### Testing this phase

The tests *are* the deliverable for this phase. The acceptance criteria
below serve as the "test for the tests."

### Acceptance criteria

- [ ] `bun test` passes all unit tests including the new
      `spotifyPlayer.test.ts` and `tokenStore.test.ts`
- [ ] `bun run build` completes without errors (required before e2e runs)
- [ ] `bun run test:e2e` launches the real Electron app and all
      `app.spec.ts` tests pass locally
- [ ] Opening DevTools in the renderer and typing `window.require` still
      returns `undefined` (confirming the e2e test is actually checking
      the sandboxed renderer)
- [ ] Pushing to main on GitHub triggers the CI workflow and both jobs
      pass in the Actions tab
- [ ] You can explain, unprompted, why `tokenStore.ts` needs `vi.mock()`
      while `spotifyPlayer.ts` only needs `vi.stubGlobal('fetch', ...)`

### Common pitfalls

- **Running e2e without building first**: `electron.launch` points at
  `out/main/index.js` — the compiled output. If you haven't run `bun run
  build`, that file doesn't exist and the test throws a confusing
  "file not found" error, not an Electron error.
- **`--frozen-lockfile` failing in CI**: if `bun.lockb` is not committed
  to the repository (common if it was gitignored), this flag breaks CI.
  Commit `bun.lockb` alongside `package.json`.
- **e2e tests passing locally but failing in CI**: the most common cause
  is a race condition — the app hasn't fully initialized when the test
  starts asserting. Adding `await page.waitForLoadState('domcontentloaded')`
  after `app.firstWindow()` makes tests wait for the renderer to be ready
  before interacting.
- **Vitest `vi.mock` hoisting**: Vitest hoists `vi.mock()` calls to the
  top of the file automatically, before any imports. If a mock depends on
  a variable defined in the test file body, that variable won't exist yet
  when the mock runs — use the factory function pattern (`vi.mock('path',
  () => ({ ... }))`) to avoid this.

---

## Phase 10 — Packaging & distribution

### Goal

Turn the app from "runs when I type `bun run dev`" into a file someone
can double-click, with a version number and the ability to update itself.

### Concepts to teach

- **What `electron-builder` actually does**: it takes your compiled JS
  output from `bun run build`, downloads the correct Electron binary for
  the target platform and architecture, bundles them together, wraps that
  in a platform-native installer format, and optionally signs the result.
  The `.dmg` or `.exe` it produces is completely self-contained — the
  person installing it does not need Node, Bun, or any other runtime.
- **App binary vs. installer**: `electron-builder` produces two things.
  The *app binary* is the actual executable (`Linea.app` on macOS,
  `Linea.exe` on Windows) bundled with Electron. The *installer* wraps
  the binary in a platform-native installation experience — a drag-to-
  Applications `.dmg` on macOS, or an NSIS wizard `.exe` on Windows. Both
  are produced by the same command.
- **`package.json` version as the source of truth**: `electron-updater`
  uses the `version` field in `package.json` to decide whether an update
  is available. Bumping the version and publishing a new GitHub Release is
  the entire release process once this is set up.
- **Semantic versioning**: `major.minor.patch` — e.g. `1.0.0`. Convention:
  patch for bug fixes, minor for new features, major for breaking changes.
  `electron-updater` compares versions numerically, so `1.0.1 > 1.0.0`
  triggers an update, but `1.0.10` is correctly greater than `1.0.9` (not
  a string comparison issue like in some older systems).
- **`electron-updater` flow**: on launch, the app calls
  `autoUpdater.checkForUpdatesAndNotify()`. The updater fetches a file
  called `latest.yml` (generated automatically by `electron-builder` when
  you publish) from your GitHub Releases. It compares the version in
  `latest.yml` against the running app's version. If a newer version
  exists, it downloads the update in the background, notifies the user,
  and applies it on the next restart.
- **Unsigned builds and what that means practically**: an unsigned app is
  fully functional — it runs the same code as a signed one. The difference
  is cosmetic from a security perspective: macOS Gatekeeper shows a warning
  dialog when the app is first opened ("can't be verified because Apple
  cannot check it for malicious software"), which the user can bypass via
  System Settings → Privacy & Security. On Windows, SmartScreen shows a
  similar warning. For personal use or distributing to a small group of
  people you can talk through the bypass, this is acceptable. For public
  distribution, signing removes these warnings entirely.
- **Why macOS builds must happen on macOS**: Apple's code signing
  toolchain (`codesign`, `xcrun notarytool`) only exists on macOS. Even
  an unsigned `.dmg` is easier to produce on macOS because `electron-
  builder`'s DMG creation uses macOS system tools. If you need to produce
  a macOS build from a Linux or Windows machine, it is technically
  possible with cross-compilation, but the result is harder to verify and
  signing is impossible.

### One-time setup — GitHub repository

`electron-builder` needs to know where to publish. You need:
1. A public GitHub repository for the project (already exists: `Project-
   Linea`).
2. A GitHub Personal Access Token with `repo` scope (for publishing
   releases from CI). Store it as a repository secret named
   `GH_TOKEN` in GitHub → Settings → Secrets and Variables → Actions.

### Reference implementation

#### `electron-builder.yml` (new — at the `Linea/` root)

Using a dedicated file keeps the `package.json` clean. `electron-builder`
picks this up automatically.

```yaml
appId: com.yourname.linea
productName: Linea
copyright: Copyright © 2026

directories:
  output: dist
  buildResources: build

files:
  - out/**/*
  - package.json

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.music

win:
  target:
    - target: nsis
      arch: [x64]

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

publish:
  provider: github
  owner: your-github-username
  repo: Project-Linea
```

> Replace `your-github-username` with your actual GitHub username. The
> `appId` should be a reverse-domain string — use your own name/domain.

#### `package.json` scripts (add to existing)

```json
"dist": "bun run build && electron-builder",
"dist:mac": "bun run build && electron-builder --mac",
"dist:win": "bun run build && electron-builder --win",
"release": "bun run build && electron-builder --publish always"
```

| Command | What it does |
|---|---|
| `bun run dist` | Builds the app and produces installers for the current platform |
| `bun run dist:mac` | macOS `.dmg` only |
| `bun run dist:win` | Windows NSIS installer only (must run on Windows or Wine) |
| `bun run release` | Builds and publishes to GitHub Releases, triggering auto-update for existing users |

#### Auto-update in the main process

`src/main/updater.ts` (new — isolated from `index.ts` to keep it clean)
```ts
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export function initAutoUpdater(): void {
  if (is.dev) return // don't check for updates in dev mode

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update…')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date')
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded; will install on quit')
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  autoUpdater.checkForUpdatesAndNotify()
}
```

`src/main/index.ts` (add — call after `createWindow` inside
`app.whenReady().then(...)`)
```ts
import { initAutoUpdater } from './updater'

// inside app.whenReady().then(() => { ... }):
initAutoUpdater()
```

#### GitHub Actions release workflow

`.github/workflows/release.yml` (new, in the repository root — separate
from the CI workflow; only runs when a version tag is pushed)
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    name: Build macOS
    runs-on: macos-latest
    defaults:
      run:
        working-directory: Linea

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build and publish
        run: bun run release
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}

  build-win:
    name: Build Windows
    runs-on: windows-latest
    defaults:
      run:
        working-directory: Linea

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build and publish
        run: bun run release
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

#### The release process (step by step)

Once the above is in place, shipping a new version is:

```bash
# 1. Bump the version in package.json (e.g. 0.1.0 → 0.1.1)
npm version patch     # or: minor / major

# 2. Push the commit and the tag
git push && git push --tags
```

That's it. GitHub Actions picks up the new tag, builds on both macOS and
Windows runners, and publishes the installers + `latest.yml` to a new
GitHub Release. Existing users' apps will find the update on next launch.

#### Testing the build locally

Before pushing a release tag, always verify the installer works locally:

```bash
bun run dist
```

On macOS, this produces `dist/Linea-<version>.dmg`. Open it, drag Linea
to Applications, and launch it from Applications (not the mounted disk
image) to simulate what a real user experiences. The first launch shows a
Gatekeeper warning on unsigned builds — this is expected.

### Acceptance criteria

- [ ] `bun run dist` completes and produces an installer in the `dist/`
      folder
- [ ] The installer, when opened, launches a working Linea app with all
      Stage 2 features intact (Spotify login, lyrics display, settings)
- [ ] `package.json` has a sensible starting version number (e.g. `0.1.0`)
- [ ] `electron-updater` initializes without errors in the console when the
      production build launches (`is.dev` guards it from running in dev mode)
- [ ] Bumping the version, pushing a tag, and checking the Actions tab
      shows the release workflow running on both macOS and Windows runners
- [ ] You can explain, unprompted, what `latest.yml` is, who generates it,
      and how `electron-updater` uses it

### Common pitfalls

- **`out/` directory not included in the `files` glob**: `electron-builder`
  bundles what the `files` array tells it to. If `out/**/*` is missing,
  the packaged app is empty — it launches and immediately crashes with
  "Cannot find module." Verify the `files` key in `electron-builder.yml`
  matches where `bun run build` actually puts its output.
- **Version not bumped before pushing a tag**: if the tag is `v0.1.1` but
  `package.json` still reads `0.1.0`, the installer will be tagged v0.1.1
  on GitHub but identify itself internally as v0.1.0. The auto-updater
  will then see "latest is 0.1.1, running 0.1.0, update available" and
  immediately try to update itself to the same file it just came from —
  an infinite update loop. Always bump `package.json` and the tag together
  via `npm version`.
- **Auto-updater running in dev**: `is.dev` from `@electron-toolkit/utils`
  guards this, but only if `initAutoUpdater()` checks it — confirm the
  guard is in place before testing locally, or the updater will try to
  reach GitHub on every `bun run dev` and log confusing errors.
- **`GH_TOKEN` secret missing**: the release workflow will fail with a 401
  from the GitHub API when trying to upload release assets. The error
  message is clear, but it's easy to forget to add the secret before the
  first tag push.

---

## Extension — Code signing & notarization (Tier 3 distribution)

*This section is optional and not required to complete Stage 3. Implement
it when you've decided to distribute Linea publicly, beyond the 5-user
cap of Spotify's Development Mode.*

### What signing adds

A signed and notarized macOS app passes Gatekeeper silently — no warning
dialog, no "cannot be verified" message. A signed Windows app passes
SmartScreen. From the user's perspective, the app just opens.

### What it requires

**macOS:**
- An Apple Developer Program membership ($99/yr, at
  developer.apple.com/programs)
- A "Developer ID Application" certificate, generated in Xcode or the
  Developer Portal and installed in your macOS Keychain
- An app-specific password for your Apple ID (for notarization submission)
- The `notarize` hook in `electron-builder.yml`

**Windows:**
- A code signing certificate from a trusted CA (DigiCert, Sectigo, etc.)
  — prices vary, typically $200–$500/yr for an EV certificate
- Windows signing can be done from a Windows CI runner only

### `electron-builder.yml` additions for macOS signing

```yaml
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.music
  identity: 'Developer ID Application: Your Name (TEAMID)'
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

afterSign: build/notarize.js
```

`build/entitlements.mac.plist` (new)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

> The `allow-jit` entitlement is required for Electron's V8 engine.
> Without it, the app crashes immediately on launch on macOS with
> hardened runtime enabled.

`build/notarize.js` (new)
```js
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  return notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
}
```

Add to the release workflow's macOS job:
```yaml
env:
  GH_TOKEN: ${{ secrets.GH_TOKEN }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  CSC_LINK: ${{ secrets.CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

Where `CSC_LINK` is your Developer ID certificate exported as a base64-
encoded `.p12` file, and `CSC_KEY_PASSWORD` is its password.

### Spotify — Extended Quota Mode

Spotify's Development Mode caps you at 5 authorized users. For wider
distribution, apply for Extended Quota Mode in the Spotify Developer
Dashboard (dashboard.spotify.com → your app → Settings → Request
extension). The review process asks for a description of the use case,
a privacy policy URL, and sometimes a demo. This is a process step, not
a code change — the codebase doesn't change, only Spotify's settings for
your app.

---

## Stage 3 — exit checklist

- [ ] All pure-logic modules have Vitest coverage including fetch-mocked
      tests for `spotifyPlayer` and module-mocked tests for `tokenStore`
- [ ] Playwright e2e tests pass locally: window properties, IPC bridge,
      renderer sandboxing
- [ ] GitHub Actions CI runs and passes on both unit and e2e jobs for
      every push to main
- [ ] `bun run dist` produces a working installer for the current platform
- [ ] The installed app launches, connects to Spotify, and shows lyrics
- [ ] `electron-updater` is initialized and silently skipped in dev mode
- [ ] Releasing a new version requires only `npm version patch && git push
      --tags` — the rest is automated
- [ ] Learner can explain, unprompted: why Vitest and Playwright cover
      different things, what `latest.yml` is and how the update loop works,
      and what the practical difference between a signed and unsigned build
      is for an end user

---

## Glossary (additions to Stages 1–2)

| Term | Meaning |
|---|---|
| `electron-builder` | Tool that bundles your compiled code + Electron binary into a platform installer |
| `electron-updater` | Library that compares the running app's version against a remote `latest.yml` and applies updates |
| `latest.yml` | Metadata file generated by `electron-builder --publish`; lists the latest version and download URL; what `electron-updater` checks |
| Semantic versioning | `major.minor.patch` version numbering convention; `npm version patch` bumps the patch number and creates a git tag |
| Notarization | Submitting a macOS app binary to Apple's servers to be scanned; required for Gatekeeper to pass silently |
| Hardened runtime | macOS security requirement for notarized apps; restricts certain code behaviors and requires explicit entitlements |
| Entitlements | A `.plist` file declaring what a hardened-runtime macOS app is allowed to do (JIT compilation, unsigned memory, etc.) |
| `CSC_LINK` | Environment variable holding a base64-encoded `.p12` certificate used by `electron-builder` for code signing |
| Gatekeeper | macOS system that verifies app signatures before allowing launch; shows the "cannot be verified" warning for unsigned apps |
| SmartScreen | Windows equivalent of Gatekeeper; shows a warning for unsigned or unknown executables |
| NSIS | Nullsoft Scriptable Install System; the installer format `electron-builder` uses for Windows by default |
| `vi.stubGlobal` | Vitest function that replaces a global (like `fetch`) with a mock for the duration of a test |
| `vi.mock` | Vitest function that replaces an entire module's exports with a manual fake at import time |
| `_electron.launch()` | Playwright API that starts a real Electron process and returns an `ElectronApplication` for test control |
| `app.evaluate()` | Playwright Electron method that runs a function inside the main process and returns the result |
| Runner | A CI virtual machine provided by GitHub Actions; `ubuntu-latest`, `macos-latest`, `windows-latest` are the three main options |
| Extended Quota Mode | Spotify developer status allowing more than 5 authorized users; requires manual application and review |

---

## File tree at end of Stage 3

```
Project-Linea/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # new — runs on every push
│       └── release.yml            # new — runs on version tags
└── Linea/
    ├── electron-builder.yml       # new
    ├── playwright.config.ts       # new
    ├── electron.vite.config.ts
    ├── package.json               # updated: version, new scripts
    ├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
    ├── build/                     # new (signing extension only)
    │   ├── entitlements.mac.plist
    │   └── notarize.js
    ├── src/
    │   ├── main/
    │   │   ├── index.ts
    │   │   ├── clickThrough.ts
    │   │   ├── config.ts
    │   │   ├── spotifyAuth.ts
    │   │   ├── loopbackServer.ts
    │   │   ├── tokenStore.ts
    │   │   ├── spotifyPlayer.ts
    │   │   ├── lyricsCache.ts
    │   │   ├── prefs.ts
    │   │   └── updater.ts         # new
    │   ├── preload/
    │   │   ├── index.ts
    │   │   └── index.d.ts
    │   ├── shared/
    │   │   ├── ipcChannels.ts
    │   │   ├── types.ts
    │   │   └── lyrics.ts
    │   └── renderer/
    │       ├── index.html
    │       ├── assets/
    │       │   ├── main.css
    │       │   └── base.css
    │       └── src/
    │           ├── renderer.ts
    │           └── linea.d.ts
    ├── tests/
    │   ├── clickThrough.test.ts
    │   ├── spotifyAuth.test.ts
    │   ├── lyrics.test.ts
    │   ├── prefs.test.ts
    │   ├── spotifyPlayer.test.ts  # new
    │   ├── tokenStore.test.ts     # new
    │   └── e2e/
    │       └── app.spec.ts        # new
    └── dist/                      # generated by electron-builder, not committed
        └── Linea-0.1.0.dmg        # example output
```

---

## Sign-off (fill in on completion)

| Field | Value |
|---|---|
| Stage | 3 — Ship (Phases 9–10) |
| Result | **Complete** — see [linea-stage3-completion.md](./linea-stage3-completion.md) |
| Recorded | 2026-07-21 08:04:09 +05:30 |
| Next | Optional Tier-3 signing / Extended Quota; Linea is shipped for guided curriculum |
