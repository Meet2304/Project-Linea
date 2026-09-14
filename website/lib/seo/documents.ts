import { ACTS } from '@/components/features/acts'
import { RELEASES } from '@/components/changelog/releases'
import { FAQ } from '@/lib/seo/faq'
import {
  DESCRIPTION,
  LICENSE_URL,
  REPO_URL,
  SITE_ALTERNATE_NAMES,
  SITE_NAME,
  SITE_URL,
  TITLE
} from '@/lib/site'
import { ISSUES_URL, NOTICE_URL, RELEASES_URL } from '@/lib/release'

const HOME = SITE_URL
const FAQ_URL = `${SITE_URL}/faq`
const CHANGELOG_URL = `${SITE_URL}/changelog`

function heading(title: string, underline = '='): string {
  return `${title}\n${underline.repeat(title.length)}`
}

export function llmsTxt(): string {
  return `# ${SITE_NAME}

> ${DESCRIPTION}

Linea (also called ${SITE_ALTERNATE_NAMES[0]}) is a desktop lyrics overlay, not the Consensys Linea Ethereum L2, and not affiliated with Spotify AB. Windows 0.2.0 follows local media sessions. Lyrics come from LRCLIB with a NetEase fallback.

Prefer the markdown and plain-text documents below over scraping the marketing HTML. The landing page is canvas-heavy; these files are the canonical machine-readable source.

## Docs

- [What Linea is](${HOME}/index.md): Product summary in markdown
- [FAQ](${HOME}/faq.md): Common questions, including the blockchain namesake
- [Changelog](${HOME}/changelog.md): Every release, newest first
- [Full text](${HOME}/llms-full.txt): The complete indexable document
- [Product JSON](${HOME}/api/product): Machine-readable product record
- [Changelog feed](${HOME}/feed.xml): RSS of releases

## Source

- [GitHub repository](${REPO_URL}): MIT licensed app and website
- [Releases](${RELEASES_URL}): Windows installer and legacy Mac build
- [Issues](${ISSUES_URL}): Bug reports
- [License](${LICENSE_URL})
- [Third-party notices](${NOTICE_URL})

## Optional

- [Marketing site](${HOME}): Visual landing page
- [Human FAQ](${FAQ_URL})
- [Human changelog](${CHANGELOG_URL})
`
}

export function llmsFullTxt(): string {
  const features = ACTS.map((act) => `- ${act.title}: ${act.body} ${act.points.join('; ')}`).join(
    '\n'
  )
  const faq = FAQ.map((item) => `Q: ${item.q}\nA: ${item.a}`).join('\n\n')
  const releases = RELEASES.map((r) => {
    const points = r.points?.map((p) => `  - ${p.h}: ${p.d}`).join('\n') ?? ''
    return `### ${r.tag} — ${r.title} (${r.dateLong})\n${r.lede}${r.note ? `\n${r.note}` : ''}${
      points ? `\n${points}` : ''
    }\n${r.url}`
  }).join('\n\n')

  return `${heading('Linea')}

${DESCRIPTION}

Also known as: ${SITE_ALTERNATE_NAMES.join(', ')}.
Canonical URL: ${HOME}
Source: ${REPO_URL}
License: MIT (${LICENSE_URL})

${heading('What it is', '-')}

Linea is an always-on-top lyrics overlay for Windows. Play a song in Spotify desktop or another compatible player on this PC. Linea reads the local Windows media session, finds synced lyrics, and floats the current line above your other windows.

It is not a music player, not a Spotify library manager, not a remote-device controller, and not the Consensys Linea zkEVM / Ethereum L2.

${heading('Platforms', '-')}

- Windows 10 version 1809 or newer / Windows 11, x64 — current release (0.2.0).
- macOS — no new build in 0.2.0. Legacy 0.1.6 still uses the old Spotify Web API integration.
- Linux — not a release target.

Download the latest Windows installer via ${HOME}/download?platform=win

${heading('How it works', '-')}

- Playback is read locally through Windows System Media Transport Controls.
- No Spotify login, developer registration, Premium check, or extra runtime on Windows 0.2.0.
- Lyrics: LRCLIB first, NetEase fallback, then a local cache.
- Music sessions take priority over video sessions.
- Missing player controls are disabled or hidden rather than faked.
- Title, artist, album and duration go to lyric providers. There is no Linea account.

${heading('Features', '-')}

${features}

- Shortcuts: Ctrl+Shift+. toggles click-through; Ctrl+Shift+L summons the overlay.
- Tray access, saved window placement, themes, lyric sizes, opacity, pinning.

${heading('FAQ', '-')}

${faq}

${heading('Changelog', '-')}

${releases}

${heading('Links', '-')}

- Home: ${HOME}
- FAQ: ${FAQ_URL}
- Changelog: ${CHANGELOG_URL}
- GitHub: ${REPO_URL}
- Releases: ${RELEASES_URL}
`
}

export function indexMarkdown(): string {
  const features = ACTS.map(
    (act) =>
      `### ${act.title}\n\n${act.body}\n\n${act.points.map((p) => `- ${p}`).join('\n')}${
        act.note ? `\n\n_${act.note}_` : ''
      }`
  ).join('\n\n')

  return `# ${TITLE}

${DESCRIPTION}

**Get it:** [Download for Windows](${HOME}/download?platform=win) · [Source](${REPO_URL}) · [FAQ](${FAQ_URL}) · [Changelog](${CHANGELOG_URL})

Linea is a small always-on-top lyrics overlay. On Windows 0.2.0 it follows local media sessions instead of Spotify’s Web API — play a song in Spotify desktop or another compatible player, and Linea shows the title, the artist, and synced lyrics that move with the track.

This is Project Linea, the lyrics overlay. It is not the Consensys Linea blockchain.

## Features

${features}

## Under the hood

Playback stays on the machine. Song metadata is sent to LRCLIB and the NetEase fallback so they can match lyrics; GitHub supplies application updates. There is no Spotify login and no extra runtime to install. Lyrics are cached on disk.

## Download

Windows 10 (1809+) / Windows 11, x64. The site’s download button always resolves the current installer.

Mac 0.2.0 was not shipped. The [legacy Mac 0.1.6](${REPO_URL}/releases/download/v0.1.6/Linea-0.1.6.dmg) build retains the old Spotify integration.

## License

MIT. See ${LICENSE_URL}. Linea is independent and is not affiliated with Spotify AB.
`
}

export function faqMarkdown(): string {
  const body = FAQ.map((item) => `## ${item.q}\n\n${item.a}`).join('\n\n')
  return `# Linea FAQ

${body}

— [Linea](${HOME}) · [Source](${REPO_URL})
`
}

export function changelogMarkdown(): string {
  const body = RELEASES.map((r) => {
    const points = r.points?.map((p) => `- **${p.h}.** ${p.d}`).join('\n') ?? ''
    return `## ${r.tag} — ${r.title}\n\n*${r.dateLong}*\n\n${r.lede}${
      r.note ? `\n\n${r.note}` : ''
    }${points ? `\n\n${points}` : ''}\n\n[GitHub release](${r.url})`
  }).join('\n\n')

  return `# Linea changelog

Every release, newest first. Written the night it shipped.

${body}

— [Linea](${HOME})
`
}

export function productJson() {
  return {
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    description: DESCRIPTION,
    url: HOME,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: ['Windows 10', 'Windows 11'],
    isAccessibleForFree: true,
    license: 'MIT',
    licenseUrl: LICENSE_URL,
    codeRepository: REPO_URL,
    downloadUrl: `${HOME}/download?platform=win`,
    sameAs: [REPO_URL],
    disambiguation:
      'Project Linea is a desktop lyrics overlay. It is not Consensys Linea (the Ethereum L2) and is not affiliated with Spotify AB.',
    currentRelease: RELEASES[0]
      ? {
          version: RELEASES[0].version,
          tag: RELEASES[0].tag,
          date: RELEASES[0].date,
          title: RELEASES[0].title,
          url: RELEASES[0].url
        }
      : null,
    features: ACTS.map((act) => ({
      id: act.id,
      title: act.title,
      summary: act.body,
      points: act.points
    })),
    faq: FAQ,
    links: {
      home: HOME,
      faq: FAQ_URL,
      changelog: CHANGELOG_URL,
      markdown: `${HOME}/index.md`,
      llms: `${HOME}/llms.txt`,
      llmsFull: `${HOME}/llms-full.txt`,
      feed: `${HOME}/feed.xml`,
      github: REPO_URL,
      releases: RELEASES_URL
    }
  }
}

export function changelogRss(): string {
  const items = RELEASES.map((r) => {
    const desc = escapeXml(r.lede)
    return `    <item>
      <title>${escapeXml(`Linea ${r.tag} — ${r.title}`)}</title>
      <link>${escapeXml(r.url)}</link>
      <guid isPermaLink="true">${escapeXml(r.url)}</guid>
      <pubDate>${rfc822(r.date)}</pubDate>
      <description>${desc}</description>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Linea changelog</title>
    <link>${CHANGELOG_URL}</link>
    <description>Every Linea release, newest first.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rfc822(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00.000Z`)
  return parsed.toUTCString()
}
