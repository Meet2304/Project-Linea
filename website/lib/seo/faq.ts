/**
 * Questions people (and crawlers) actually ask. Rendered on /faq, copied
 * into llms.txt / markdown mirrors, and emitted as FAQPage JSON-LD — keep
 * the answers honest and short. This is not a keyword dump.
 */
export interface FaqItem {
  q: string
  a: string
}

export const FAQ: FaqItem[] = [
  {
    q: 'What is Linea?',
    a: 'Linea is a free, open-source desktop lyrics overlay. On Windows it sits always-on-top, reads the song your player is already playing through the local media session, and shows synced lyrics as the track moves. It is a small overlay, not a music player, not a library manager, and not a remote-device controller.'
  },
  {
    q: 'Is this the Linea blockchain?',
    a: 'No. Project Linea is a lyrics overlay. It is not Consensys Linea, the Ethereum L2, and it is not affiliated with Spotify AB. If you searched for “Linea” and landed here looking for a zkEVM, this is a different project.'
  },
  {
    q: 'How do I download Linea?',
    a: 'The current Windows installer is the 0.2.0 release on GitHub. The website download button always resolves the latest Windows build. There is no new Mac build in 0.2.0; the legacy Mac 0.1.6 download still uses the old Spotify integration.'
  },
  {
    q: 'Does Linea need a Spotify account?',
    a: 'Not on Windows 0.2.0. Linea follows local Windows media sessions instead of Spotify’s Web API, so there is no Spotify login, developer registration, Premium check, or extra runtime to install. Play a song in Spotify desktop or another compatible player on this PC and Linea follows it.'
  },
  {
    q: 'Which music players work with Linea?',
    a: 'Any Windows player that exposes a System Media Transport Controls session — Spotify desktop is the usual case, and other desktop players that hold the media keys often work too. Browser music services, ads, incomplete metadata, and players that never publish a session have limited or no support. Linea prefers actively playing music when more than one session is open.'
  },
  {
    q: 'Where do the lyrics come from?',
    a: 'Synced lyrics are fetched from LRCLIB, with a NetEase fallback when LRCLIB cannot match the track. Matches are cached on disk so a song you have already played still works offline. Not every track has synced lyrics; Linea does not invent lines or timestamps.'
  },
  {
    q: 'Does Linea work on Mac or Linux?',
    a: '0.2.0 is a Windows release (Windows 10 version 1809 or newer / Windows 11, x64). Mac playback is under separate development. The legacy Mac 0.1.6 build is still available and still talks to Spotify the old way, with that version’s account restrictions. Linux is not a release target.'
  },
  {
    q: 'Is Linea free and open source?',
    a: 'Yes. Linea is MIT licensed. The full source is on GitHub — fork it, build it, or read how the overlay, the lyric chain and the Windows helper work. Third-party notices live in NOTICE.md.'
  },
  {
    q: 'What can I do from the overlay?',
    a: 'Synced, scrollable lyrics with optional timestamps and a jump-to-current-line control. Play, pause, next, previous and seek where the session supports them; shuffle and repeat when the player exposes both the control and its state. The overlay is resizable, with themes, lyric sizes, opacity, pinning and click-through. Ctrl+Shift+. toggles click-through; Ctrl+Shift+L summons Linea. Each track also gets a live cymatic plate instead of album art.'
  },
  {
    q: 'Nothing is playing / Linea cannot see my song.',
    a: 'Start playback in a desktop player on this PC. If Windows cannot see that player’s media session, Linea cannot see it either. A persistent media-access message means the helper is reconnecting. Missing lyrics and unreachable lyric providers have their own messages; cached lyrics remain usable offline.'
  },
  {
    q: 'Does Linea send my music library anywhere?',
    a: 'Playback stays local. Song title, artist, album and duration are sent to lyric providers so they can match the track. GitHub is used for application updates. There is no Linea account and no Spotify token on the Windows 0.2.0 path.'
  }
]
