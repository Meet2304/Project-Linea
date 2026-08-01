# Project-Linea

<p align = 'center'>
  <img src = 'https://github.com/Meet2304/Project-Linea/blob/main/Project%20Linea%20Header_v0.2.png'>
</p>

<h1 align="center">Linea</h1>

<p align = 'justify'>
Linea is a lightweight desktop overlay that displays the lyrics of your currently playing songs from Spotify in real time—right on your screen.

No switching tabs. No searching manually. No interruptions.

Just a minimal, floating window that stays out of your way while keeping you connected to the words behind the music.

> Your music, as a quiet layer.

## Features

- **Scrollable synced lyrics** — timestamped LRC lyrics from lrclib, highlighted in time with playback; scroll to read ahead and tap the minimal "now" button to snap back to the current line
- **Lyrics-first, landscape overlay** — a compact, freely resizable window that fills to your size; drag any edge or corner to resize, drag the top bar to move
- **Full transport** — play/pause, skip, seek, shuffle, and repeat right from the overlay (playback control requires Spotify Premium)
- **Cymatic thumbnail** — a small procedurally-generated standing-wave tile beside the title, unique per track and evolving while the song plays
- **Light & dark themes** — pure-white "quiet layer" or near-black glass, one toggle away
- **Personalizable** — pin on top and close from the top bar; three lyric-size presets (with a live preview), and optional lyric timestamps in settings
- **Click-through mode** — let clicks pass through the overlay (`Ctrl+Shift+.`)
- **Always reachable** — a system-tray icon and a summon shortcut (`Ctrl+Shift+L`) bring the window back to the front even when it's unpinned and buried behind other apps
- **Fast by design** — event-driven lyric scheduling (no always-on loop), adaptive polling that backs off when idle, and crash-resilient main/renderer error handling
</p>

## "Nothing playing" after connecting

Linea's Spotify app is in **Development Mode**, which is the default for every
Spotify app and admits only accounts the developer has added by hand — up to 25
of them. Any other account finishes the login normally, then gets `403` on every
API call, so the overlay connects and then never shows a song.

If that is you, the panel now says so instead of sitting on "Nothing playing".
[Open an issue](https://github.com/Meet2304/Project-Linea/issues) with the email
on your Spotify account and it can be added.

Two things to rule out first, because they look identical:

- **Private session.** Spotify reports no playback at all while one is on, so
  there is genuinely nothing for Linea to read. Turn it off and play something.
- **Nothing actually playing on a device Spotify knows about.** Web-player-only
  playback sometimes does not register; play from the desktop or phone app.

Lifting the 25-account limit needs Spotify to grant **Extended Quota Mode**,
which is a manual review. Until then the allowlist is the ceiling.

## Repository layout

| Path             | What it is                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| `Linea/`         | The Electron app                                                              |
| `website/`       | The marketing site (Next.js) — see [`website/README.md`](./website/README.md) |
| `documentation/` | Internal design and build notes                                               |

## Website

```bash
cd website
bun install
bun run dev        # http://localhost:3000
```

## License

Linea is [MIT licensed](./LICENSE). Third-party attributions — Electron, the
Outfit and Space Mono typefaces, Lucide icons, and lyrics from
[lrclib.net](https://lrclib.net) — are listed in [NOTICE.md](./NOTICE.md).

Linea is an independent project and is not affiliated with, endorsed by, or
sponsored by Spotify AB.
