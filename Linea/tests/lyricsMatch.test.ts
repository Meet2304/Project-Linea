import { describe, it, expect } from 'vitest'
import { normalizeName, scoreCandidate, pickBest, type Candidate } from '../src/main/lyrics/match'
import type { LyricsQuery } from '../src/main/lyrics/types'

const QUERY: LyricsQuery = {
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354
}

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354,
  hasSynced: true,
  ...over
})

describe('normalizeName', () => {
  it('strips parenthesised and bracketed decoration', () => {
    expect(normalizeName('Bohemian Rhapsody (Remastered 2011)')).toBe('bohemian rhapsody')
    expect(normalizeName('Bohemian Rhapsody [Live]')).toBe('bohemian rhapsody')
  })

  it('strips feat. tails', () => {
    expect(normalizeName('Under Pressure feat. David Bowie')).toBe('under pressure')
    expect(normalizeName('Under Pressure ft David Bowie')).toBe('under pressure')
  })

  it('strips a trailing dash segment only when it is an edition marker', () => {
    expect(normalizeName('Bohemian Rhapsody - Radio Edit')).toBe('bohemian rhapsody')
    // Not an edition marker — the tail is part of the title.
    expect(normalizeName('Archie - Marry Me')).toBe('archie marry me')
  })

  it('folds diacritics so accented spellings compare equal', () => {
    expect(normalizeName('Beyoncé')).toBe(normalizeName('Beyonce'))
  })

  it('preserves CJK characters', () => {
    expect(normalizeName('安靜')).toBe('安靜')
  })
})

describe('scoreCandidate', () => {
  it('scores an exact match at the top', () => {
    expect(scoreCandidate(candidate(), QUERY)).toBeGreaterThan(0.95)
  })

  it('accepts a small duration difference', () => {
    expect(scoreCandidate(candidate({ durationSec: 357 }), QUERY)).toBeGreaterThan(0.8)
  })

  it('rejects a wildly different duration', () => {
    expect(scoreCandidate(candidate({ durationSec: 394 }), QUERY)).toBe(0)
  })

  it('allows a larger duration gap when title and artist are both exact', () => {
    // 20s apart: rejected for a fuzzy name match, allowed for an exact one.
    expect(scoreCandidate(candidate({ durationSec: 374 }), QUERY)).toBeGreaterThan(0)
    expect(scoreCandidate(candidate({ durationSec: 374, trackName: 'Bohemian Rap City' }), QUERY))
      .toBe(0)
  })

  it('rejects a different song by the same artist', () => {
    expect(scoreCandidate(candidate({ trackName: 'Somebody to Love' }), QUERY)).toBe(0)
  })

  it('rejects a cover by a different artist', () => {
    expect(scoreCandidate(candidate({ artistName: 'Panic! At The Disco' }), QUERY)).toBe(0)
  })

  it('accepts a provider listing extra credited artists', () => {
    expect(scoreCandidate(candidate({ artistName: 'Queen, David Bowie' }), QUERY)).toBeGreaterThan(0)
  })

  it('treats an unreported duration as neutral rather than disqualifying', () => {
    expect(scoreCandidate(candidate({ durationSec: 0 }), QUERY)).toBeGreaterThan(0)
  })

  it('rewards a matching album but never requires one', () => {
    // Scored off a non-perfect candidate: an exact match already clamps to 1,
    // so the bonus only ever breaks ties among imperfect candidates.
    const withAlbum = scoreCandidate(candidate({ durationSec: 360 }), QUERY)
    const withoutAlbum = scoreCandidate(
      candidate({ durationSec: 360, albumName: 'Greatest Hits' }),
      QUERY
    )
    expect(withAlbum).toBeGreaterThan(withoutAlbum)
    expect(withoutAlbum).toBeGreaterThan(0)
  })

  // Containment scores 0.85, so without an explicit check these clear every
  // threshold and scroll the wrong words against the song.
  it.each([
    'Bohemian Rhapsody Karaoke',
    'Bohemian Rhapsody (Instrumental)',
    'Bohemian Rhapsody - Remix',
    'Bohemian Rhapsody (Made Famous By Queen)'
  ])('rejects the derivative recording %s', (trackName) => {
    expect(scoreCandidate(candidate({ trackName }), QUERY)).toBe(0)
  })

  it('accepts a karaoke entry when a karaoke track is what is playing', () => {
    const karaokeQuery = { ...QUERY, trackName: 'Bohemian Rhapsody (Karaoke Version)' }
    expect(
      scoreCandidate(candidate({ trackName: 'Bohemian Rhapsody Karaoke' }), karaokeQuery)
    ).toBeGreaterThan(0)
  })
})

describe('pickBest', () => {
  it('excludes candidates without synced lyrics', () => {
    expect(pickBest([candidate({ hasSynced: false })], QUERY, 0.72)).toBeNull()
  })

  it('returns null when nothing clears the threshold', () => {
    expect(pickBest([candidate({ trackName: 'Radio Ga Ga' })], QUERY, 0.72)).toBeNull()
  })

  it('prefers the closer duration when scores tie', () => {
    const near = candidate({ durationSec: 355 })
    const far = candidate({ durationSec: 366 })
    expect(pickBest([far, near], QUERY, 0.5)?.index).toBe(1)
  })

  it('enforces a hard duration ceiling when one is given', () => {
    // Scores well, but NetEase's stricter 5s ceiling rules it out.
    const eightSecondsOff = candidate({ durationSec: 362 })
    expect(pickBest([eightSecondsOff], QUERY, 0.72)).not.toBeNull()
    expect(pickBest([eightSecondsOff], QUERY, 0.72, 5)).toBeNull()
  })

  it('skips a rejected candidate in favour of a weaker but valid one', () => {
    const karaoke = candidate({ trackName: 'Bohemian Rhapsody (Karaoke)' })
    const realButLooser = candidate({ artistName: 'Queen, David Bowie', durationSec: 360 })
    expect(pickBest([karaoke, realButLooser], QUERY, 0.72)?.index).toBe(1)
  })
})
