# Linea

A small, always-on-top lyrics overlay. The **0.2.0 beta** follows local playback instead of Spotify's Web API. Windows uses
media sessions; macOS supports Spotify desktop and Apple Music through Automation.

Play a song in Spotify desktop or another compatible Windows player. Linea shows
its title and artist, finds synced lyrics through LRCLIB with a NetEase fallback,
and follows the player's timeline. No Spotify login, developer registration,
Premium check, or additional runtime installation is required by Linea.

## Windows and macOS beta

Windows 10 version 1809 or newer / Windows 11, x64. macOS 12 or newer,
Intel and Apple Silicon. [Mac setup and limitations](./documentation/linea-macos-beta.md).
Install the beta executable from the
[0.2.0-beta.2 release](https://github.com/Meet2304/Project-Linea/releases/tag/v0.2.0-beta.2)
once published. During development, build it using the instructions in
[Linea/README.md](./Linea/README.md).

The existing stable downloads still use the legacy Spotify integration and its
account restrictions. The beta is a separate prerelease; stable installations
will not automatically receive it. Mac users authorize their running player through Settings > Music access.

## Features

- Synced, scrollable lyrics with three lines by default, optional timestamps, and a jump-to-current-line button.
- Play/pause, next/previous and seek where the selected media session supports them.
- Shuffle and repeat when the player exposes both the controls and their state.
- Music sessions take priority over videos; no manual session picker in this beta.
- Resizable overlay, themes, lyric sizes, opacity preferences, pinning and click-through.
- Per-track cymatic artwork, tray access, and saved window placement.
- Toggle click-through with Ctrl+Shift+. and summon Linea with Ctrl+Shift+L.
- Local lyric cache, provider fallback, and Windows beta updates.

Missing controls are disabled or hidden. A player without a usable timeline can
still show metadata and matched lyrics, but Linea does not invent progress or
highlight lines against an unknown position. Players must expose a session on
this PC; this is not a remote-device controller or a Spotify library manager.
Browser music services, ads and incomplete metadata may have limited support.

## Nothing playing?

Start playback in a desktop media player. If Windows cannot see that player's
media session, Linea cannot see it either. When more than one player is open,
Linea prefers actively playing music. Paused tracks stay visible until another
session takes priority.

A persistent media-access message means the helper is reconnecting. Missing
lyrics and unreachable lyric providers have separate messages; cached lyrics
remain usable offline. If reporting a problem, include Windows version, player,
song, available controls and reproduction steps, rather than account credentials.

## Development and validation

- [App setup and native build](./Linea/README.md)
- [Migration implementation and validation record](./documentation/linea-smtc-implementation.md)
- [Website setup](./website/README.md)

The Windows helper uses C++/WinRT from the Windows SDK and the static C++ runtime.
No npm runtime dependency was added for this migration. Metadata stays local for
playback; song title, artist, album and duration are sent to lyric providers.
GitHub is used for application updates.

## License

Linea is [MIT licensed](./LICENSE). See [NOTICE.md](./NOTICE.md) for third-party
attributions. Linea is independent and is not affiliated with Spotify AB.
