/**
 * Canonical site identity. Every title, description, sitemap URL and
 * structured-data node should read from here so the public name of Linea
 * cannot drift between Google, social cards and LLM crawlers.
 *
 * Override the public origin with NEXT_PUBLIC_SITE_URL (no trailing slash)
 * if the domain changes. Preview deployments keep this production host so
 * they never mint a second canonical.
 */
export const SITE_HOST = 'linea.meetbhatt.com'

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || `https://${SITE_HOST}`
).replace(/\/$/, '')

export const SITE_NAME = 'Linea'
export const SITE_ALTERNATE_NAMES = ['Project Linea', 'Linea lyrics overlay'] as const
export const SITE_TAGLINE = 'know every word'

export const TITLE = 'Linea — live lyrics overlay for Windows'
export const DESCRIPTION =
  'Linea is a free, open-source desktop lyrics overlay for Windows. It follows local media sessions, shows synced lyrics, and stays on top of whatever you are doing — no Spotify login required.'

export const CHANGELOG_TITLE = 'Changelog — Linea lyrics overlay'
export const CHANGELOG_DESCRIPTION =
  'Every Linea release, written the night it shipped. Windows media sessions, synced lyrics, and the overlay that sits above your work.'

export const FAQ_TITLE = 'FAQ — Linea lyrics overlay for Windows'
export const FAQ_DESCRIPTION =
  'What Linea is, how the Windows lyrics overlay works, which players it follows, and why it does not need a Spotify login.'

export const AUTHOR_NAME = 'Meet Bhatt'
export const AUTHOR_URL = 'https://github.com/Meet2304'
export { LICENSE_URL, REPO_URL } from '@/lib/release'

export const OG_IMAGE = {
  url: '/social/linea-whatsapp-og.png',
  width: 1200,
  height: 630,
  alt: 'Linea — know every word. A live lyrics overlay for Windows.'
} as const

export const TWITTER_IMAGE = '/social/linea-x-social.png'

export const KEYWORDS = [
  'Linea',
  'Project Linea',
  'lyrics overlay',
  'Windows lyrics overlay',
  'desktop lyrics overlay',
  'always on top lyrics',
  'synced lyrics',
  'Spotify lyrics overlay',
  'floating lyrics',
  'LRCLIB',
  'open source lyrics app',
  'Electron lyrics overlay'
] as const

/** Crawlers that read the web on behalf of search engines, LLMs and agents. */
export const AI_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'GoogleOther',
  'PerplexityBot',
  'Applebot',
  'Applebot-Extended',
  'Amazonbot',
  'Bytespider',
  'CCBot',
  'cohere-ai',
  'meta-externalagent',
  'FacebookBot',
  'YouBot',
  'Diffbot',
  'Ai2Bot',
  'DuckAssistBot'
] as const
