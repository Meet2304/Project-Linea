# Linea — Stage 1: Foundation (Phases 1–4)

**Status:** Source of truth for guided build
**Scope:** Window shell only — no Spotify, no lyrics, no persistence
**Stack:** Electron + electron-vite + vanilla TypeScript renderer (no frontend framework)

---

## How to use this document

This file is meant to be handed to an AI model (or read by a human) as the
single source of truth for guiding the build of Linea's first stage. It is
written so that a guiding session can:

- Treat each phase as a checkpoint with an explicit "definition of done."
  Don't move to the next phase until the acceptance criteria for the current
  one are met.
- Use the "Concepts to teach" list in each phase as the things the learner
  should be able to explain back in their own words before moving on — not
  just code that should run.
- Treat the code blocks as reference implementations, not copy-paste
  answers. Where possible, have the learner type the code themselves and use
  the reference to check it, rather than handing over a finished file.
- Surface the "Common pitfalls" proactively when the learner hits something
  that looks like one of them, rather than waiting to be asked.
- Keep scope honest. Things explicitly deferred to later stages (Spotify
  auth, lyrics, settings persistence, packaging) should not be pulled
  forward even if the learner asks "should we just add X now" — note it as
  a Stage 2+ item and move on.

---

## 0. Context recap

**Mission:** Linea keeps the lyrics of whatever is playing on Spotify
visible on screen, styled however the user likes, without ever pulling
focus, the cursor, or window attention away from what they're actually
doing.

**Full stack (later stages will introduce these — not built yet):**

- Electron, split into main process / preload / renderer
- electron-vite for the dev server + build tooling
- Vanilla TypeScript renderer — deliberately no React/Vue/Svelte. Linea's
  UI is a styled text box, not an application; a framework would add
  bundle weight and abstraction for no real benefit here.
- Spotify Web API via OAuth Authorization Code + PKCE (Stage 2)
- LRCLIB for synced lyrics (Stage 2)
- Local JSON file + Electron's `safeStorage` for prefs/secrets (later stage)

**The one architectural rule that must hold from day one:** all
OS-touching logic (window creation, OS APIs, file access, eventually
OAuth) lives in the **main process**. The **renderer** never reaches into
Node or Electron internals directly — it only ever talks to the main
process through a narrow, explicit API exposed by the **preload script**.
This is both a security boundary (`contextIsolation: true`,
`nodeIntegration: false`, enforced starting Phase 2) and what keeps a
future Tauri port realistic — the renderer carries over almost unchanged;
only the native-facing layer would need rewriting.

---

## Stage 1 — definition of done

By the end of Phase 4, the learner has:

- A project that runs via a single dev command, with hot reload on the
  renderer.
- A window that is frameless, transparent, always-on-top, and draggable.
- A global keyboard shortcut that toggles click-through mode.
- A button inside the window that triggers that same toggle — but routed
  through a secure IPC bridge instead of the shortcut.
- `contextIsolation: true` and `nodeIntegration: false` throughout, verified
  by hand (not just configured).
- One working unit test, proving the project's test runner is wired up
  before any real feature logic exists to test.

No Spotify. No lyrics. No saved preferences. Those start in Stage 2.

---

## Phase 1 — Environment & tooling

### Goal

Get from "nothing" to a running Electron dev environment with hot reload,
and understand what each piece of the generated project is for.

### Concepts to teach

- **Node.js & npm**: Node runs JavaScript outside a browser; npm is its
  package manager and the thing reading `package.json`.
- **package.json**: `dependencies` ship inside the built app;
  `devDependencies` (Electron itself, build tools, TypeScript) are only
  needed while building/developing — they're stripped from what you ship.
- **npm scripts**: named shortcuts (`npm run dev`) defined in
  `package.json`, not magic — just shell commands with a nickname.
- **electron-vite**: a build tool that compiles three independent things
  from one project — the main process, the preload script, and the
  renderer — each with different bundling needs (main/preload are Node
  code; renderer is browser code).
- **The "localhost" equivalent**: in dev mode, electron-vite runs Vite's
  dev server for the renderer (a real `http://localhost:5173`), and the
  Electron window loads its URL instead of a static file. Saving a
  renderer file hot-reloads instantly, the same as any web dev workflow.
  The main process doesn't hot-reload — changing it restarts the whole
  Electron process automatically, the equivalent of restarting a Node
  server.

### Step by step

1. Install Node.js LTS (v18 or newer). Verify with `node -v` and `npm -v`.
2. Scaffold the project:
   ```bash
   npm create @quick-start/electron@latest linea
   ```
   When prompted, choose the **vanilla** template with **TypeScript**
   (not React/Vue — see Context recap above for why).
3. ```bash
   cd linea
   npm install
   ```
4. Look at the generated structure before changing anything:
   ```
   linea/
   ├── electron.vite.config.ts
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── main/
   │   │   └── index.ts
   │   ├── preload/
   │   │   └── index.ts
   │   └── renderer/
   │       ├── index.html
   │       └── src/
   │           └── main.ts
   ```
5. Run it:
   ```bash
   npm run dev
   ```
   A window should open. This is the scaffold's default content — it will
   be replaced in Phase 2.

### package.json scripts you'll actually use this stage

| Script          | What it does                                                                       |
| --------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`   | Starts the Vite dev server + launches Electron pointed at it. Hot reload on.       |
| `npm run build` | Bundles main/preload/renderer into static output. No window opens — just compiles. |

### Acceptance criteria

- [ ] `node -v` reports 18+
- [ ] `npm run dev` opens a window with no errors in the terminal
- [ ] Editing a file under `src/renderer` and saving updates the open
      window without a manual restart

### Common pitfalls

- **Old Node version**: electron-vite requires a reasonably modern Node;
  if `npm install` fails with cryptic engine errors, check `node -v` first.
- **Antivirus flags `electron.exe`** on first run on Windows — this is a
  known false positive with Electron's unsigned dev binary, not a real
  problem.
- **Nothing happens on `npm run dev`**: check the terminal output, not just
  for a window — most failures here are a missing `npm install` or a typo
  in a path, and they show up as text in the terminal before anything
  visual breaks.

---

## Phase 2 — Minimal window shell

### Goal

Replace the scaffold's default content with a deliberately minimal window
that shows "Linea" — understanding every line of `main/index.ts` rather
than treating it as boilerplate.

### Concepts to teach

- **App lifecycle events**: `app.whenReady()` fires once Electron has
  finished initializing — nothing window-related can happen before this.
  `window-all-closed` fires when the last window closes. `activate` fires
  on macOS when the user clicks the dock icon with no windows open.
- **Why macOS is special here**: Mac apps conventionally keep running with
  no windows open (think Safari's dock icon staying lit after you close
  every tab); Windows/Linux apps conventionally quit. That's why
  `window-all-closed` checks `process.platform !== 'darwin'` before
  quitting.
- **`BrowserWindow` + `webPreferences`**: the window itself is configured
  through a constructor object. `webPreferences.preload` points at the
  preload script; `contextIsolation: true` and `nodeIntegration: false`
  are set now, even though nothing uses them yet, because retrofitting
  security flags after writing renderer code that assumes Node access is
  much more painful than starting locked down.
- **`loadURL` vs `loadFile`**: in dev, the window loads the Vite dev server
  URL (hot reload); in a production build, there is no dev server, so it
  loads the built `index.html` straight off disk. `electron-vite` exposes
  the dev URL via `process.env['ELECTRON_RENDERER_URL']`, which is `undefined`
  in a production build — that's the branch condition.

### Reference implementation

`src/main/index.ts`

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 200,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

`src/preload/index.ts` (placeholder — stays nearly empty until Phase 4)

```ts
// Nothing exposed yet. This file exists so webPreferences.preload has a
// real target to load. We start exposing a safe API here in Phase 4.
console.log('Linea preload loaded')
```

`src/renderer/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Linea</title>
    <link rel="stylesheet" href="./src/style.css" />
  </head>
  <body>
    <div id="app">Linea</div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

`src/renderer/src/style.css`

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  background: #1e1e1e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
#app {
  font-size: 24px;
}
```

`src/renderer/src/main.ts`

```ts
console.log('Linea renderer started')
```

### Acceptance criteria

- [ ] `npm run dev` opens a 360×200 window showing the word "Linea"
- [ ] Closing the window on Windows/Linux quits the app; on macOS the dock
      icon stays present (try it if on Mac, otherwise just explain it)
- [ ] You can explain, without looking at the code, why `loadURL` is used
      in dev and `loadFile` in production

### Common pitfalls

- **Blank/white window briefly on launch**: normal — the renderer takes a
  moment to load. This becomes more relevant later when deciding whether
  to show the window only after `ready-to-show` fires.
- **Preload path errors** ("cannot find module ../preload/index.js"):
  electron-vite outputs compiled files to a build directory that mirrors
  `src/`, but the relative path in `join(__dirname, ...)` is resolved at
  runtime from the _compiled_ file's location, not the source location —
  if this trips up, it's worth opening the build output folder and looking
  at where things actually landed.

---

## Phase 3 — Native window behavior

### Goal

Turn the plain window into the actual overlay shape Linea needs: frameless,
transparent, always-on-top, draggable, with click-through toggled by a
global keyboard shortcut.

### Concepts to teach

- **`frame: false`**: removes the OS title bar/border entirely. Once you do
  this, the window has no built-in way to be dragged or closed — both have
  to be reimplemented (dragging via CSS below; closing isn't needed yet
  since there's no close button in scope for Stage 1).
- **`transparent: true`**: lets the window's background show the desktop
  through it. On Windows this is more reliable when you also set
  `backgroundColor: '#00000000'` explicitly — without it, some Windows
  versions render a faint background tint instead of true transparency.
- **`alwaysOnTop: true`**: keeps the window above other app windows. It
  does _not_ by default float above other apps' fullscreen mode on macOS —
  that needs an explicit always-on-top _level_ (e.g. `'screen-saver'`),
  which is a Stage 2+ refinement, not needed yet.
- **`-webkit-app-region: drag` / `no-drag`** (CSS, renderer side): since a
  frameless window has no native drag handle, you designate a draggable
  region yourself. Anything interactive inside a draggable region (a
  button) needs `no-drag` on it specifically, or clicks won't register —
  this matters again in Phase 4 once a real button exists.
- **`setIgnoreMouseEvents`**: the actual click-through mechanism — when
  true, all mouse events pass through the window to whatever's behind it.
  This is a `BrowserWindow` instance method, callable only from the main
  process.
- **Why a global shortcut, specifically**: once click-through is on, the
  window can't receive a click to turn click-through _off_ — that would
  require clicking through it, which is exactly what's disabled. A
  `globalShortcut` (an OS-level hotkey, working even when the window isn't
  focused) is the only way out of that trap.
- **`screen` module**: used here just to position the window near a screen
  corner on launch, based on the primary display's work area size.

### Reference implementation

`src/main/index.ts` (full replacement)

```ts
import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null
let clickThrough = false

function createWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 320,
    height: 160,
    x: width - 340,
    y: 40,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function toggleClickThrough(): void {
  if (!mainWindow) return
  clickThrough = !clickThrough
  mainWindow.setIgnoreMouseEvents(clickThrough)
}

app.whenReady().then(() => {
  createWindow()
  globalShortcut.register('CommandOrControl+Shift+L', toggleClickThrough)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

`src/renderer/src/style.css` (add drag region)

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  background: rgba(20, 20, 20, 0.85);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
#app {
  font-size: 20px;
  -webkit-app-region: drag;
}
#app button {
  -webkit-app-region: no-drag;
}
```

### Acceptance criteria

- [ ] Window has no OS title bar and shows the desktop through its
      transparent background
- [ ] Window stays on top of other normal application windows
- [ ] Clicking and dragging the window body moves it
- [ ] Pressing the registered shortcut makes clicks pass through the
      window to whatever's behind it; pressing it again restores normal
      interaction
- [ ] You can explain why the shortcut has to be _global_, not a regular
      in-page keyboard listener

### Common pitfalls

- **Transparency looks gray/opaque on Windows**: missing
  `backgroundColor: '#00000000'` — Windows needs this stated explicitly
  more often than macOS does.
- **Shortcut doesn't register / silently does nothing**: another
  application may already own that key combination —
  `globalShortcut.register` returns `false` on failure; check the return
  value rather than assuming success.
- **Forgot `no-drag` on a future interactive element**: clicks on it will
  instead start a window-drag. This becomes directly relevant the moment a
  button is added in Phase 4.

---

## Phase 4 — IPC & the security boundary

### Goal

Add a real, secure communication channel between renderer and main process,
and use it to expose the same click-through toggle from Phase 3 as an
in-app button — not just a global shortcut.

### Concepts to teach

- **`contextIsolation` / `nodeIntegration` / `sandbox`**: already set in
  Phase 2, but this is where they start mattering. With `nodeIntegration:
false` and `contextIsolation: true`, the renderer's JavaScript runs in a
  context where `require`, `process`, and Node's global objects simply
  don't exist — verified by checking `window.require` is `undefined` in
  DevTools. This isn't a permissions setting you can bypass by trying
  harder in renderer code; it's a different JavaScript context entirely.
- **`contextBridge.exposeInMainWorld`**: the _only_ sanctioned way to give
  the renderer access to anything — you explicitly hand it a named object
  with specific functions, each of which internally calls back into IPC.
  Nothing is exposed except exactly what you write here.
- **`ipcRenderer.invoke` / `ipcMain.handle`** (request–response): the
  renderer calls a function, gets a `Promise` back, main process computes
  a result and resolves it. This is the pattern to default to for almost
  everything — it reads like a normal async function call from the
  renderer's point of view.
- **`ipcRenderer.send` / `ipcMain.on`** (fire-and-forget): no return value,
  just an event. Worth knowing exists, but `invoke`/`handle` is preferred
  here because the click-through toggle has a result (the new state) the
  UI wants to display.
- **Shared channel-name constants**: hardcoding the string `'linea:toggle-
click-through'` in two separate files (preload and main) is a silent bug
  waiting to happen — a single typo in one place breaks the bridge with no
  compile error. Defining channel names once in a shared file and
  importing them on both sides turns that typo into a TypeScript error
  instead.
- **Never trust the renderer**: every `ipcMain.handle` is effectively a
  tiny API endpoint — if it ever takes arguments from the renderer (it
  doesn't yet, in this phase), those arguments should be validated in the
  main process exactly as you'd validate user input to a server, because
  conceptually that's what it is.

### Reference implementation

`src/shared/ipcChannels.ts`

```ts
export const IPC = {
  TOGGLE_CLICK_THROUGH: 'linea:toggle-click-through',
  GET_CLICK_THROUGH_STATE: 'linea:get-click-through-state'
} as const
```

`src/preload/index.ts` (full replacement)

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'

contextBridge.exposeInMainWorld('linea', {
  toggleClickThrough: () => ipcRenderer.invoke(IPC.TOGGLE_CLICK_THROUGH),
  getClickThroughState: () => ipcRenderer.invoke(IPC.GET_CLICK_THROUGH_STATE)
})
```

`src/main/index.ts` (add to the existing Phase 3 file)

```ts
import { ipcMain } from 'electron'
import { IPC } from '../shared/ipcChannels'

// inside app.whenReady().then(() => { ... }), after createWindow():
ipcMain.handle(IPC.TOGGLE_CLICK_THROUGH, () => {
  toggleClickThrough()
  return clickThrough
})

ipcMain.handle(IPC.GET_CLICK_THROUGH_STATE, () => clickThrough)
```

`src/renderer/src/linea.d.ts` (type declaration so TypeScript knows
`window.linea` exists)

```ts
interface LineaAPI {
  toggleClickThrough: () => Promise<boolean>
  getClickThroughState: () => Promise<boolean>
}

declare global {
  interface Window {
    linea: LineaAPI
  }
}

export {}
```

`src/renderer/src/main.ts` (full replacement)

```ts
const app = document.getElementById('app')
const button = document.createElement('button')
button.textContent = 'Toggle click-through'
app?.appendChild(button)

button.addEventListener('click', async () => {
  const isClickThrough = await window.linea.toggleClickThrough()
  button.textContent = isClickThrough ? 'Click-through ON' : 'Toggle click-through'
})
```

### Testing this phase

Extract the toggle logic into a pure function so it can be unit tested
without launching Electron at all — this is the first real test in the
project, and the pattern (pure logic separated from Electron-API calls)
is what makes most of Linea testable later.

`src/main/clickThrough.ts`

```ts
export function nextClickThroughState(current: boolean): boolean {
  return !current
}
```

`tests/clickThrough.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { nextClickThroughState } from '../src/main/clickThrough'

describe('nextClickThroughState', () => {
  it('flips false to true', () => {
    expect(nextClickThroughState(false)).toBe(true)
  })
  it('flips true to false', () => {
    expect(nextClickThroughState(true)).toBe(false)
  })
})
```

Install Vitest (`npm install -D vitest`) and add a `"test": "vitest run"`
script to `package.json`, then `npm test`.

### Acceptance criteria

- [ ] A button inside the window toggles click-through, and its label
      updates to reflect the new state
- [ ] The global shortcut from Phase 3 and the new button both control the
      same underlying state correctly (toggling one is reflected if you
      then check the other)
- [ ] Opening DevTools in the renderer and typing `window.require` returns
      `undefined`; typing `window.linea` returns the exposed object
- [ ] `npm test` runs and passes the two `nextClickThroughState` cases
- [ ] You can explain, without looking at the code, why the channel names
      live in a shared file instead of being typed directly into the
      preload and main files

### Common pitfalls

- **TypeScript complains `window.linea` doesn't exist**: the `.d.ts`
  declaration file needs to be picked up by `tsconfig` — if it's not in an
  included path, add it, or move it next to the other renderer source
  files.
- **Calling `ipcRenderer` directly from a renderer file instead of through
  the exposed `window.linea` API**: this works (Electron won't stop you)
  but defeats the entire point of the boundary — flag this immediately if
  it happens, since it's the single most common shortcut that quietly
  breaks the security model this phase exists to teach.
- **Button clicks drag the window instead of clicking**: missing
  `-webkit-app-region: no-drag` on the button — covered in Phase 3, easy to
  forget once a real interactive element shows up.

---

## Stage 1 — exit checklist

- [ ] `npm run dev` launches the app with renderer hot reload working
- [ ] Window is frameless, transparent, always-on-top, and draggable
- [ ] Global shortcut toggles click-through
- [ ] In-app button toggles the same click-through state via IPC
- [ ] `contextIsolation: true`, `nodeIntegration: false` confirmed by
      checking `window.require` is `undefined` in DevTools
- [ ] `npm test` passes
- [ ] Learner can explain, unprompted: the main/preload/renderer split,
      why the security flags exist, why click-through needs a global
      shortcut, and what `invoke`/`handle` does versus `send`/`on`

If any of these aren't true, stay in Stage 1 — Stage 2 (Spotify auth,
currently-playing polling, lyrics) assumes all of the above is solid.

---

## Glossary

| Term                      | Meaning                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Main process              | The Node.js process Electron runs; owns windows, has OS/file access                                                    |
| Renderer process          | A Chromium tab rendering your UI; no Node access by default                                                            |
| Preload script            | Runs before the renderer's page loads; the only place allowed to bridge main ↔ renderer                                |
| `contextBridge`           | API used in preload to expose a hand-picked object to the renderer                                                     |
| `contextIsolation`        | Security setting keeping preload's JS context separate from the page's — required for `contextBridge` to be meaningful |
| `nodeIntegration`         | Whether the renderer has direct Node access; always `false` here                                                       |
| IPC                       | Inter-process communication — the message-passing system connecting main and renderer                                  |
| `ipcMain` / `ipcRenderer` | The two halves of Electron's IPC API, one per process                                                                  |
| `BrowserWindow`           | The class representing an actual OS window                                                                             |
| `webPreferences`          | Configuration object controlling a `BrowserWindow`'s renderer security/behavior                                        |
| App lifecycle             | `app.whenReady()`, `window-all-closed`, `activate` — events marking app/window state changes                           |
| `globalShortcut`          | OS-level hotkey registration, works even when the app isn't focused                                                    |
| Frameless window          | A `BrowserWindow` with no OS title bar/border (`frame: false`)                                                         |
| Click-through             | Mode where the window ignores mouse events, passing clicks to whatever's behind it                                     |
| HMR                       | Hot Module Replacement — updating running code in place without a full reload                                          |
| Vite                      | The dev server / bundler electron-vite uses for the renderer                                                           |

---

## Appendix: file tree at end of Stage 1

```
linea/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   └── clickThrough.ts
│   ├── preload/
│   │   └── index.ts
│   ├── shared/
│   │   └── ipcChannels.ts
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── style.css
│           └── linea.d.ts
└── tests/
    └── clickThrough.test.ts
```
