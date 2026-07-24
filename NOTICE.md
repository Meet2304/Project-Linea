# Third-party notices

Linea is released under the [MIT License](./LICENSE). It builds on the work below,
each under its own license.

## Runtime

| Project | License |
| --- | --- |
| [Electron](https://github.com/electron/electron) | MIT |
| [electron-updater](https://github.com/electron-userland/electron-builder) | MIT |
| [@electron-toolkit/preload](https://github.com/alex8088/electron-toolkit) · [@electron-toolkit/utils](https://github.com/alex8088/electron-toolkit) | MIT |

Electron bundles Chromium and Node.js. Their licenses ship inside every packaged
build as `LICENSES.chromium.html` and `LICENSE.electron.txt`.

## Fonts

| Font | License |
| --- | --- |
| [Outfit](https://github.com/Outfitio/Outfit-Fonts) | SIL Open Font License 1.1 |
| [Space Mono](https://github.com/googlefonts/spacemono) | SIL Open Font License 1.1 |

Both are vendored via [Fontsource](https://fontsource.org) in the app and loaded
through `next/font` on the website.

## Icons

Iconography is [Lucide](https://lucide.dev) (ISC License). The app inlines the
individual paths rather than depending on the package.

## UI credits

The animated sun/moon theme toggle is adapted from
[Skiper UI](https://skiper-ui.com)'s `ThemeToggleButton2`, itself inspired by
[toggles.dev](https://toggles.dev). See `Linea/src/renderer/index.html`.

## Data and services

**Lyrics** come from [lrclib.net](https://lrclib.net), a free and open lyrics
database. Linea queries its public API and caches results locally. Lyrics remain
the property of their respective rights holders; Linea neither hosts nor
redistributes them.

**Playback state** comes from the [Spotify Web API](https://developer.spotify.com).
Linea uses the OAuth 2.0 Authorization Code flow with PKCE and stores no client
secret. Playback control requires a Spotify Premium account.

> Linea is an independent, unofficial project. It is **not affiliated with,
> endorsed by, or sponsored by Spotify AB**. Spotify is a trademark of Spotify AB.

## Design

The visual language — the cymatic patterns, the ordered-dither treatment, and the
token system — originates in the "Linea Design System" Claude Design project and
is included here under the same MIT license as the rest of the repository.
