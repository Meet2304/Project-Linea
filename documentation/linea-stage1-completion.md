# Linea — Stage 1 Completion Record

**Status:** Complete  
**Completed:** 2026-06-17 22:53:15 +05:30 (local)  
**Verified:** 2026-06-17 — `bun test` (2/2 pass), `bun run typecheck` (pass)  
**Application path:** `Linea/` (within `Project-Linea` repository)  
**Build guide:** [linea-stage1-foundation.md](./linea-stage1-foundation.md)

---

## Summary

Stage 1 delivered a working Electron overlay shell: frameless, transparent, always-on-top, draggable, resizable, with click-through toggled by a global shortcut and an in-app button over a secure IPC bridge. No Spotify integration, lyrics, or persisted settings — those are deferred to Stage 2.

The architectural rule from day one is in place: OS-facing logic lives in the **main process**; the **renderer** is a locked-down web UI; **preload** exposes a narrow `window.linea` API via `contextBridge`.

---

## Timeline

| Milestone                            | Date / time (local, +05:30) | Notes                                                       |
| ------------------------------------ | --------------------------- | ----------------------------------------------------------- |
| Repository initial commit            | 2026-06-17 (per `git log`)  | `Project-Linea` root                                        |
| Stage 1 foundation guide written     | 2026-06-17                  | `documentation/linea-stage1-foundation.md`                  |
| Project scaffolded (`electron-vite`) | 2026-06-17                  | `bun create @quick-start/electron@latest` in `Linea/`       |
| Phase 1 — dev environment            | 2026-06-17                  | `bun install`, `bun run dev`, renderer hot reload confirmed |
| Phase 2 — minimal window shell       | 2026-06-17                  | 360×200 → later 320×160; security flags set                 |
| Phase 3 — native overlay behavior    | 2026-06-17                  | Frameless, transparent, drag, global shortcut               |
| Phase 4 — IPC & tests                | 2026-06-17                  | `window.linea`, Vitest wired                                |
| **Stage 1 signed off**               | **2026-06-17 22:53:15**     | Implementation reviewed and accepted                        |

---

## Exit checklist (Stage 1)

All criteria from the foundation guide are met:

- [x] `bun run dev` launches the app with renderer hot reload
- [x] Window is frameless, transparent, always-on-top, and draggable
- [x] Global shortcut toggles click-through
- [x] In-app button toggles the same click-through state via IPC
- [x] `contextIsolation: true`, `nodeIntegration: false` (configured in `webPreferences`)
- [x] `npm test` / `bun test` passes (`nextClickThroughState` — 2 cases)
- [x] Main / preload / renderer split with shared IPC channel constants

**Manual verification recommended once per machine:** open DevTools in the renderer and confirm `window.require` is `undefined` and `window.linea` is defined.

---

## Technology choices

| Area                               | Choice                                             | Rationale                                                                 |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| Package manager                    | **Bun** (`bun install`, `bun run dev`, `bun test`) | Developer preference; scripts in `package.json` remain standard           |
| Scaffold tool                      | `@quick-start/electron` (electron-vite)            | Official quick-start; vanilla + TypeScript template                       |
| UI framework                       | **Vanilla TypeScript**                             | Linea is a text overlay; no React/Vue bundle overhead                     |
| TypeScript                         | Yes                                                | End-to-end typing; separate `tsconfig.node` / `tsconfig.web`              |
| Electron updater (scaffold prompt) | No (at scaffold time)                              | Not needed for Stage 1; `electron-updater` remains as scaffold dependency |
| Download mirror (scaffold prompt)  | No (at scaffold time)                              | Default Electron install URLs used                                        |
| Test runner                        | **Vitest**                                         | Pure logic testable without launching Electron                            |
| Lint / format                      | ESLint + Prettier                                  | From scaffold                                                             |

---

## Implementation choices (vs. foundation reference)

These are intentional deviations or learnings during the build:

| Topic                  | Foundation reference                  | Implemented                                                                                         |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Global shortcut        | `CommandOrControl+Shift+L`            | **`CommandOrControl+Shift+Period`** — `Ctrl+Shift+L` was already owned on the dev machine           |
| Window resizable       | `resizable: false`                    | **`resizable: true`** — user can choose overlay size                                                |
| Default window size    | 360×200 (Phase 2) → 320×160 (Phase 3) | **320×160**, positioned top-right via `screen.getPrimaryDisplay().workAreaSize`                     |
| Drag region            | `-webkit-app-region: drag` on `#app`  | **On `body`** — full panel draggable, not only the text node                                        |
| Button click target    | `#app button { no-drag }`             | Same — required for Phase 4 button                                                                  |
| Shortcut error message | Generic                               | Logs **`Ctrl+Shift+Period`** when registration fails                                                |
| Scaffold utilities     | Stripped in reference                 | **`@electron-toolkit/utils` retained** — `ready-to-show`, DevTools shortcuts, external link handler |
| `sandbox`              | Not specified                         | **`sandbox: false`** (scaffold default); security via `contextIsolation` + `nodeIntegration: false` |
| Project layout         | `linea/` at repo root                 | App lives in **`Linea/`** subdirectory; docs at repo `documentation/`                               |

---

## Runtime behavior

### Window

- **Frameless** (`frame: false`) — no OS title bar
- **Transparent** (`transparent: true`, `backgroundColor: '#00000000'`)
- **Always on top** (`alwaysOnTop: true`)
- **Hidden from taskbar** (`skipTaskbar: true`)
- **Initial position:** top-right of primary display work area (`x: width - 340`, `y: 40`)
- **Shown after** `ready-to-show` to reduce white flash on launch

### Click-through

- **Toggle function:** `toggleClickThrough()` in main — flips `clickThrough` via `nextClickThroughState()`, calls `setIgnoreMouseEvents(clickThrough)`
- **Global shortcut:** `Ctrl+Shift+.` (Windows/Linux) / `Cmd+Shift+.` (macOS)
- **In-app control:** button in renderer calls `window.linea.toggleClickThrough()`
- **Shared state:** shortcut and IPC both use the same `clickThrough` variable and `toggleClickThrough()`
- **Cleanup:** `globalShortcut.unregisterAll()` on `will-quit`

### Security boundary

- `contextIsolation: true`, `nodeIntegration: false`
- Preload exposes only:

```ts
window.linea = {
  toggleClickThrough: () => Promise<boolean>,
  getClickThroughState: () => Promise<boolean>
}
```

- IPC channel names centralized in `src/shared/ipcChannels.ts`
- Renderer does **not** import or call `ipcRenderer` directly

---

## File tree (Stage 1 deliverable)

```
Linea/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts          # Window, shortcut, IPC handlers
│   │   └── clickThrough.ts   # Pure toggle logic (tested)
│   ├── preload/
│   │   ├── index.ts          # contextBridge → window.linea
│   │   └── index.d.ts        # Legacy scaffold types (window.electron — unused)
│   ├── shared/
│   │   └── ipcChannels.ts    # IPC channel name constants
│   └── renderer/
│       ├── index.html
│       ├── assets/
│       │   ├── main.css      # Overlay + drag/no-drag styles
│       │   └── base.css      # Scaffold variables (partially unused)
│       └── src/
│           ├── renderer.ts   # UI + click-through button
│           └── linea.d.ts    # Window.linea TypeScript types
└── tests/
    └── clickThrough.test.ts
```

---

## Key dependencies (pinned ranges in `package.json`)

| Package                          | Role                                            |
| -------------------------------- | ----------------------------------------------- |
| `electron` ^39.2.6               | Desktop runtime                                 |
| `electron-vite` ^5.0.0           | Main / preload / renderer bundling + dev server |
| `vite` ^7.2.6                    | Renderer dev server and HMR                     |
| `typescript` ^5.9.3              | Type checking                                   |
| `vitest` ^4.1.9                  | Unit tests                                      |
| `@electron-toolkit/utils` ^4.0.0 | Dev shortcuts, `is.dev`, app user model ID      |

---

## Commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `bun install`       | Install dependencies                                     |
| `bun run dev`       | Start electron-vite dev server + Electron (renderer HMR) |
| `bun run build`     | Typecheck + production bundle to `out/`                  |
| `bun test`          | Run Vitest (`vitest run`)                                |
| `bun run typecheck` | TypeScript check (node + web projects)                   |
| `bun run lint`      | ESLint                                                   |

---

## Known limitations (acceptable for Stage 1)

- **Button label vs. shortcut:** toggling click-through via the global shortcut does not update the button label until the next button click. State in main is correct; UI sync is a polish item.
- **Stale scaffold CSS:** unused rules (`.logo`, `.actions`, etc.) remain in `main.css`.
- **Stale `preload/index.d.ts`:** still declares `window.electron` from the original scaffold; preload no longer exposes it.
- **Unused dependency:** `@electron-toolkit/preload` listed in `package.json` but not imported in current preload.
- **Click-through on:** the in-app button cannot receive clicks while click-through is active — by design; use the global shortcut to disable.
- **Packaging / auto-update:** `electron-builder` and `electron-updater` are present from scaffold but not exercised in Stage 1.

---

## Issues encountered and resolved

| Issue                               | Cause                                                                                                | Resolution                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `mainWindow` possibly null (TS)     | `ready-to-show` callback; module-level nullable type                                                 | Local `const win = mainWindow` for window callbacks                                |
| Global shortcut registration failed | `Ctrl+Shift+L` owned by another app                                                                  | Switched to `Ctrl+Shift+Period`                                                    |
| Preload import errors               | Semicolons in `ipcChannels` object; `.ts` extension in import; `shared/` not in `tsconfig.node.json` | Commas in object literal; extensionless import; added `src/shared/**/*` to include |
| Drag only on text                   | `-webkit-app-region: drag` on small `#app`                                                           | Applied drag to `body` (full panel)                                                |

---

## Architectural notes for Stage 2

Stage 2 should extend the same patterns:

1. **New IPC channels** in `src/shared/ipcChannels.ts`
2. **New `window.linea` methods** in preload via `contextBridge`
3. **Handlers in main** — Spotify OAuth, token storage, API polling, lyrics fetch
4. **Renderer** — display lyrics; still no direct Node/Electron access
5. **Pure logic** in testable modules under `src/main/` (like `clickThrough.ts`)

Do not pull forward from later stages until Stage 2 guide exists: Spotify PKCE auth, LRCLIB lyrics, `safeStorage` / JSON prefs, production packaging.

---

## References

- [Stage 1 build guide](./linea-stage1-foundation.md) — phases, acceptance criteria, reference implementations
- [electron-vite](https://electron-vite.org/)
- [Electron security tutorial](https://www.electronjs.org/docs/latest/tutorial/security)

---

## Sign-off

| Field      | Value                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Stage      | 1 — Foundation (Phases 1–4)                                                        |
| Result     | **Complete**                                                                       |
| Recorded   | 2026-06-17 22:53:15 +05:30                                                         |
| Next stage | Stage 2 — complete; see [linea-stage2-completion.md](./linea-stage2-completion.md) |
