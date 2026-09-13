import type { PlayerCapabilities, PlayerState, PlaybackSnapshot } from './types'

export const REPORT_KINDS = ['problem', 'idea', 'crash'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]
export const USER_REPORT_KINDS = ['problem', 'idea'] as const
export type UserReportKind = (typeof USER_REPORT_KINDS)[number]

export const MIN_MESSAGE = 8
export const MAX_MESSAGE = 2_000
export const CRASH_DEDUP_MS = 60 * 60 * 1000

export interface ReportDiagnostics {
  version: string
  os: string
  player: string
  song: string
  lyrics: string
  source: string
  controls: string
  crashKind: string
  crashReason: string
}

export interface UserReport {
  kind: UserReportKind
  message: string
}

export interface SubmitResult {
  ok: boolean
  error?: string
}

export interface OsInfo {
  version: string
  platform: string
  osVersion: string
  arch: string
}

const MAX_FIELD = 300

export function clip(value: string, max = MAX_FIELD): string {
  return value.trim().slice(0, max)
}

export function formatOsLabel(info: OsInfo): string {
  const ver = clip(info.osVersion)
  const arch = clip(info.arch)
  const suffix = [ver, arch ? `(${arch})` : ''].filter(Boolean).join(' ')
  if (info.platform === 'win32') return clip(`Windows ${suffix}`)
  if (info.platform === 'darwin') return clip(`macOS ${suffix}`)
  return clip(`${info.platform} ${suffix}`.trim())
}

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

export function emptyDiagnostics(os: OsInfo): ReportDiagnostics {
  return {
    version: clip(os.version, 40),
    os: formatOsLabel(os),
    player: '',
    song: '',
    lyrics: '',
    source: '',
    controls: '',
    crashKind: '',
    crashReason: ''
  }
}

export function diagnosticsFromSnapshot(
  os: OsInfo,
  snapshot: PlaybackSnapshot | null
): ReportDiagnostics {
  const base = emptyDiagnostics(os)
  if (!snapshot) return base
  const player = snapshot.player
  return {
    ...base,
    player: player ? friendlyPlayerName(player.sourceAppId) : '',
    song: formatSong(player),
    lyrics: snapshot.lyrics.status,
    source: snapshot.sourceStatus,
    controls: player ? formatControls(player.capabilities) : ''
  }
}

export function crashSignature(crashKind: string, crashReason: string, version: string): string {
  const part = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 80)
  return `linea-crash:${part(crashKind)}:${part(crashReason)}:${part(version)}`
}

export function parseUserReport(value: unknown): UserReport | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  const kind = rec.kind
  const message = rec.message
  if (kind !== 'problem' && kind !== 'idea') return null
  if (typeof message !== 'string') return null
  const clipped = clip(message, MAX_MESSAGE)
  if (clipped.length < MIN_MESSAGE) return null
  return { kind, message: clipped }
}

/** One send per signature per hour so a flapping GPU does not flood the inbox. */
export class CrashDeduper {
  private readonly last = new Map<string, number>()

  constructor(private readonly windowMs = CRASH_DEDUP_MS) {}

  allow(signature: string, now = Date.now()): boolean {
    if (!signature) return false
    const prev = this.last.get(signature)
    if (prev !== undefined && now - prev < this.windowMs) return false
    this.last.set(signature, now)
    return true
  }
}
