# Linea development

## Prerequisites

- Node.js and Bun.
- On Windows: Visual Studio 2022 or Build Tools 2022 with Desktop development
  with C++, MSVC v143 x64 tools, and a Windows 10/11 SDK (10.0.17763 or newer).
- End users need only the installer. No .NET or separate Visual C++ runtime is
  required by the statically linked helper.

## Build and run

Run from this directory:

```powershell
bun install --frozen-lockfile
bun run dev
bun run build:win
```

Windows development and build commands compile the helper automatically.
The installer is written to dist/Linea-0.2.0-beta.1-setup.exe.
To inspect an unpacked build, run bun run build:unpack.

On macOS, bun run build and bun run build:mac skip the native build. The overlay
opens with a Windows-only message; macOS playback is not implemented. Linux is
not a release target for this beta.

## Checks

```powershell
bun run typecheck
bun run test
bun run test:e2e
```

UI tests use a temporary profile and disable real media discovery so they do not
control your music. Windows and macOS UI jobs run in CI.

For live Windows verification, start Spotify desktop playback:

```powershell
bun run build:unpack
node scripts/check-smtc.mjs dist/win-unpacked/resources/smtc/linea-smtc.exe
node scripts/check-smtc.mjs dist/win-unpacked/resources/smtc/linea-smtc.exe --controls
node scripts/check-live.mjs
powershell -NoProfile -File scripts/check-smtc-performance.ps1
```

The controls check changes playback briefly, including track skips. It restores
shuffle/repeat and playback state, and restores the position if the original
track is still selected. The live UI check reads playback, requests lyrics and
uses a temporary profile. Screenshots and measurements live in ignored
output/playwright/; do not commit fetched lyrics or real-song screenshots.

If discovery fails in an isolated execution sandbox, repeat the read-only helper
probe in the normal interactive Windows user session. No elevation is required
for normal installation or use.

## Architecture

The native helper in native/smtc/ owns WinRT access only. It communicates using
versioned JSON lines over private standard pipes. The TypeScript bridge
supervises it, times out failed requests, and reacquires it after resume.
Session selection, timeline mapping, cache identity and lyric lookup stay in
TypeScript. The renderer receives revision-ordered playback snapshots.

Windows packaging copies only linea-smtc.exe into resources/smtc outside app.asar.
The executable never needs to be unpacked or downloaded at runtime. All generated
native output is ignored by Git.

## Release policy

Version/tag: 0.2.0-beta.1 / v0.2.0-beta.1. Beta tags produce a Windows-only GitHub
prerelease with beta.yml; they are never marked latest. The package wrapper
explicitly selects the update channel, and afterPack rejects a mismatch. Stable tags retain the
separate stable workflow. Do not promote this beta to stable until outstanding
platform and installer acceptance checks are resolved.

The website's explicitly labelled beta link goes to the beta release page.
Stable download routing remains unchanged. Publishing the website or a release
is separate from building the local installer.
