import type { LyricsStatus } from './lyrics'
import type { PlayerCapabilities, PlayerState, SourceStatus } from './types'

/**
 * Query keys are shared with website/lib/feedback.ts. The overlay only
 * builds the website URL; the site composes the GitHub issue from it.
 */
export const FEEDBACK_PAGE = 'https://project-linea.vercel.app/feedback'

export const FEEDBACK_KINDS = ['broken', 'lyrics', 'playback', 'idea'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export interface Diagnostics {
  version: string
  platform: string
  osVersion: string
  arch: string
}

export interface FeedbackPrefill {
  kind?: FeedbackKind
  version?: string
  windows?: string
  player?: string
  song?: string
  controls?: string
  lyrics?: string
  source?: string
}

const MAX_FIELD = 300

function clip(value: string): string {
  return value.trim().slice(0, MAX_FIELD)
}

export function formatWindowsLabel(diag: Diagnostics): string {
  const ver = clip(diag.osVersion)
  const arch = clip(diag.arch)
  const suffix = [ver, arch ? `(${arch})` : ''].filter(Boolean).join(' ')
  if (diag.platform === 'win32') return clip(`Windows ${suffix}`)
  if (diag.platform === 'darwin') return clip(`macOS ${suffix}`)
  return clip(`${diag.platform} ${suffix}`.trim())
}

/**
 * SMTC appIds are AUMIDs / exe names. Map the ones people actually run
 * Linea against; unknown values pass through so a report still names them.
 */
export function friendlyPlayerName(appId: string): string {
  const id = appId.toLowerCase()
  if (id.includes('spotify')) return 'Spotify'
  if (id.includes('applemusic') || id.includes('itunes')) return 'Apple Music'
  if (id.includes('youtubemusic') || id.includes('youtube.music')) return 'YouTube Music'
  if (id.includes('youtube')) return 'YouTube'
  if (id.includes('msedge') || id.includes('edge')) return 'Edge'
  if (id.includes('chrome')) return 'Chrome'
  if (id.includes('firefox') || id.includes('mozilla')) return 'Firefox'
  if (id.includes('vlc')) return 'VLC'
  if (id.includes('foobar')) return 'foobar2000'
  if (id.includes('aimp')) return 'AIMP'
  if (id.includes('music.ui') || id.includes('zune')) return 'Windows Media Player'
  return clip(appId)
}

const CONTROL_ORDER: (keyof PlayerCapabilities)[] = [
  'play',
  'pause',
  'next',
  'previous',
  'seek',
  'shuffle',
  'repeat'
]

export function formatControls(capabilities: PlayerCapabilities): string {
  return CONTROL_ORDER.filter((name) => capabilities[name]).join(', ')
}

export function formatSong(player: PlayerState | null): string {
  if (!player?.trackId) return ''
  const title = clip(player.trackName)
  const artist = clip(player.artistName)
  if (title && artist) return clip(`${title} — ${artist}`)
  return title || artist
}

export function feedbackPageUrl(prefill: FeedbackPrefill): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(prefill)) {
    const clipped = typeof value === 'string' ? clip(value) : ''
    if (clipped) params.set(key, clipped)
  }
  const query = params.toString()
  return query ? `${FEEDBACK_PAGE}?${query}` : FEEDBACK_PAGE
}

export function feedbackPageUrlFromSession(input: {
  diagnostics: Diagnostics
  player: PlayerState | null
  lyricsStatus: LyricsStatus
  sourceStatus: SourceStatus
}): string {
  const song = formatSong(input.player)
  const playbackKind: FeedbackKind | undefined =
    input.sourceStatus === 'unavailable' || input.sourceStatus === 'unsupported'
      ? 'playback'
      : undefined
  const lyricsKind: FeedbackKind | undefined =
    !playbackKind && (input.lyricsStatus === 'none' || input.lyricsStatus === 'unreachable')
      ? 'lyrics'
      : undefined

  return feedbackPageUrl({
    kind: playbackKind ?? lyricsKind,
    version: input.diagnostics.version,
    windows: formatWindowsLabel(input.diagnostics),
    player: input.player ? friendlyPlayerName(input.player.sourceAppId) : '',
    song,
    controls: input.player ? formatControls(input.player.capabilities) : '',
    lyrics: input.lyricsStatus,
    source: input.sourceStatus
  })
}
