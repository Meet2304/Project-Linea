import { describe, expect, it } from 'bun:test'
import {
  draftFromSearch,
  githubIssueUrl,
  issueBody,
  issueTitle,
  reportLooksReady
} from './feedback'

describe('draftFromSearch', () => {
  it('reads the overlay query string and ignores unknown kinds', () => {
    const draft = draftFromSearch(
      'kind=lyrics&song=Bohemian+Rhapsody+%E2%80%94+Queen&version=0.2.0&bogus=no'
    )
    expect(draft.kind).toBe('lyrics')
    expect(draft.song).toBe('Bohemian Rhapsody — Queen')
    expect(draft.version).toBe('0.2.0')
    expect(draft.what).toBe('')
  })

  it('falls back to broken when kind is missing or junk', () => {
    expect(draftFromSearch('kind=explode').kind).toBe('broken')
    expect(draftFromSearch('').kind).toBe('broken')
  })
})

describe('github issue', () => {
  it('omits empty environment rows and refuses a too-short description', () => {
    const draft = {
      kind: 'broken' as const,
      title: 'Overlay vanished',
      what: 'It disappeared after I resized it.',
      windows: 'Windows 11',
      player: '',
      song: '',
      controls: '',
      steps: '',
      version: '0.2.0',
      lyrics: '',
      source: ''
    }
    expect(reportLooksReady(draft)).toBe(true)
    expect(issueTitle(draft)).toBe('Overlay vanished')
    const body = issueBody(draft)
    expect(body).toContain('It disappeared after I resized it.')
    expect(body).toContain('- Linea: 0.2.0')
    expect(body).toContain('- Windows: Windows 11')
    expect(body).not.toContain('Player:')
    expect(githubIssueUrl(draft)).toContain('github.com/Meet2304/Project-Linea/issues/new')
    expect(githubIssueUrl(draft)).toContain('labels=bug')
  })

  it('labels ideas as enhancements and titles lyrics by song when untitled', () => {
    const draft = {
      kind: 'idea' as const,
      title: '',
      what: 'Let me pin a favourite lyric.',
      windows: '',
      player: '',
      song: '',
      controls: '',
      steps: '',
      version: '',
      lyrics: '',
      source: ''
    }
    expect(githubIssueUrl(draft)).toContain('labels=enhancement')
    expect(
      issueTitle({
        ...draft,
        kind: 'lyrics',
        song: 'Original Song — Original Artist'
      })
    ).toBe('Lyrics: Original Song — Original Artist')
    expect(reportLooksReady({ ...draft, what: 'too short' })).toBe(false)
  })
})
