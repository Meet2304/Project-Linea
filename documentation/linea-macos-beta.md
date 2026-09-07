# macOS beta (0.2.0-beta.2)

This beta adds a macOS 12+ universal app for Intel and Apple Silicon. It follows
Spotify desktop and Apple Music through macOS Automation. It does not use Spotify
OAuth, an API application ID, private MediaRemote interfaces, or a separate runtime.

## First use

1. Start a song in Spotify desktop or Apple Music.
2. Open Linea settings and click **Music access > Allow**.
3. Accept the macOS prompt allowing Linea to control the player. When using both
   players, click Allow again to authorize the second running player.
4. If access was denied, enable the player under **System Settings > Privacy &
   Security > Automation > Linea**, then retry.

Linea only discovers the two supported running applications. Reading never
launches a player or requests permission automatically. Browser players are not
supported on macOS in this beta.

## Supported controls

Title, artist, album, duration, position, play/pause, previous/next, seek, shuffle
and repeat are mapped into the existing playback and lyrics flow. Controls depend
on the player accepting its scripting commands; unavailable or rejected commands
do not become confirmed UI state. Spotify scripting exposes repeat off/all;
Apple Music also exposes repeat-one. Neither remote devices nor library likes
are supported.

A small Objective-C helper uses Apple's OSAKit and a bundled JavaScript for
Automation script. It stays outside the application archive and uses the same
bounded JSON-lines protocol as the Windows helper. Reads/commands are serialized.
Reconciliation uses the existing playing/idle cadence. Explicit permission
requests have a separate 60-second bound, during which ordinary reads wait rather
than restarting the helper. The helper exits on pipe closure or parent exit.

Each running application gets a session identity containing its process ID;
metadata/native-track changes advance its revision. Commands re-read the native
track identity before execution. Spotify duration is in milliseconds, Music
duration is in seconds, and position is in seconds for both. These values feed
the existing rate-aware lyric scheduler and metadata-based cache.

## Build and distribution

On a Mac with Xcode Command Line Tools, run from Linea/:

    bun install --frozen-lockfile
    bun run build:mac

The universal DMG contains the helper and Automation usage description and
entitlements. End users do not need developer tools. PR CI builds the Mac app,
checks the native protocol and Electron overlay, and uploads a
**linea-mac-beta** artifact containing the DMG and beta-mac.yml.

Beta release tags now build Windows and macOS. Beta update feeds remain separate
from stable. Mac updates are manual downloads from the matching beta release
page; in-place Mac updates require signing/notarization and are not claimed by
this unsigned beta. No tag or public release is created by the implementation.

## Acceptance

Local Windows validation covers the shared TypeScript, JXA adapter with simulated
player dictionaries, permission supervision, and Electron UI. Mac CI must prove
native compilation, packaging and launch. These automated checks cannot grant
user consent or prove real Spotify/Music playback.

Before public release, test the DMG on Intel and Apple Silicon Macs: Automation
allow/deny/retry, both real players, seeks/skips, source changes, sleep/resume,
cached lyrics, missing lyrics, and manual beta update routing. Check unsigned-app
launch behavior and helper shutdown on a normal account.

Three lines are now the default at every lyric text size. Fresh window height is
calculated to fit them; saved manual bounds remain. Click-through was removed
from settings and remains available via its global shortcut.

Apple references:

- [Automation entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events)
- [Automation usage description](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription)
