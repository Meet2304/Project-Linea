import { FEEDBACK_URL, ISSUES_URL, SITE_URL } from './release'

/**
 * A structured report. The README already asks for these fields; the form
 * exists so people don't have to remember the list, and so GitHub issues
 * arrive with the same shape every time.
 *
 * Query keys are shared with Linea/src/shared/feedbackUrl.ts — keep them
 * in lockstep so the overlay can pre-fill the page.
 */
export const FEEDBACK_KINDS = ['broken', 'lyrics', 'playback', 'idea'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export interface FeedbackDraft {
  kind: FeedbackKind
  title: string
  what: string
  windows: string
  player: string
  song: string
  controls: string
  steps: string
  version: string
  lyrics: string
  source: string
}

export const EMPTY_DRAFT: FeedbackDraft = {
  kind: 'broken',
  title: '',
  what: '',
  windows: '',
  player: '',
  song: '',
  controls: '',
  steps: '',
  version: '',
  lyrics: '',
  source: ''
}

export const KIND_COPY: Record<
  FeedbackKind,
  { label: string; hint: string; placeholder: string; defaultTitle: string }
> = {
  broken: {
    label: "Something's broken",
    hint: 'The overlay itself',
    placeholder: 'What did you expect, and what happened instead?',
    defaultTitle: 'Something is broken'
  },
  lyrics: {
    label: 'Lyrics are wrong or missing',
    hint: 'The words',
    placeholder: 'Wrong song, out of sync, empty, stuck on a previous track…',
    defaultTitle: 'Lyrics are wrong or missing'
  },
  playback: {
    label: "Won't follow the player",
    hint: 'What is playing',
    placeholder: 'Which player, and what Linea shows instead of that session.',
    defaultTitle: "Won't follow the player"
  },
  idea: {
    label: 'An idea',
    hint: 'Not a bug',
    placeholder: 'What would this change for you while a song is playing?',
    defaultTitle: 'Idea'
  }
}

const KIND_SET = new Set<string>(FEEDBACK_KINDS)

export function isFeedbackKind(value: string): value is FeedbackKind {
  return KIND_SET.has(value)
}

const QUERY_KEYS: (keyof FeedbackDraft)[] = [
  'kind',
  'title',
  'what',
  'windows',
  'player',
  'song',
  'controls',
  'steps',
  'version',
  'lyrics',
  'source'
]

const MAX_FIELD = 2_000

function clip(value: string): string {
  return value.trim().slice(0, MAX_FIELD)
}

export function draftFromSearch(search: string): FeedbackDraft {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const draft: FeedbackDraft = { ...EMPTY_DRAFT }
  const kind = params.get('kind') ?? ''
  draft.kind = isFeedbackKind(kind) ? kind : 'broken'
  for (const key of QUERY_KEYS) {
    if (key === 'kind') continue
    const raw = params.get(key)
    if (raw) draft[key] = clip(raw)
  }
  return draft
}

export function issueTitle(draft: FeedbackDraft): string {
  const written = clip(draft.title)
  if (written) return written
  const song = clip(draft.song)
  if (song && draft.kind === 'lyrics') return `Lyrics: ${song}`.slice(0, 80)
  if (song && draft.kind === 'playback') return `Playback: ${song}`.slice(0, 80)
  return KIND_COPY[draft.kind].defaultTitle
}

function line(label: string, value: string): string | null {
  const v = clip(value)
  return v ? `- ${label}: ${v}` : null
}

export function issueBody(draft: FeedbackDraft): string {
  const environment = [
    line('Linea', draft.version),
    line('Windows', draft.windows),
    line('Player', draft.player),
    line('Song', draft.song),
    line('Lyrics', draft.lyrics),
    line('Source', draft.source),
    line('Controls', draft.controls)
  ].filter((row): row is string => row !== null)

  const what = clip(draft.what) || '_Not described._'
  const steps = clip(draft.steps)

  const parts = [
    '### What happened',
    '',
    what,
    '',
    '### Environment',
    '',
    environment.length > 0 ? environment.join('\n') : '_Not filled in._'
  ]

  if (steps) {
    parts.push('', '### Steps', '', steps)
  }

  parts.push(
    '',
    '---',
    '',
    `Filed from ${SITE_URL}/feedback. Please don't include account passwords or API keys.`
  )

  return parts.join('\n')
}

export function githubIssueUrl(draft: FeedbackDraft): string {
  const labels = draft.kind === 'idea' ? 'enhancement' : 'bug'
  const params = new URLSearchParams({
    title: issueTitle(draft).slice(0, 120),
    body: issueBody(draft).slice(0, 6_000),
    labels
  })
  return `${ISSUES_URL}/new?${params.toString()}`
}

export function reportLooksReady(draft: FeedbackDraft): boolean {
  return clip(draft.what).length >= 12
}

export { FEEDBACK_URL }
