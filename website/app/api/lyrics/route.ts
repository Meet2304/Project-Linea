import { NextResponse } from 'next/server'
import { DEMO_TRACK, parseLrc, type LyricLine } from '@/components/demo/lyrics'

/**
 * Fetches the demo track's synced lyrics from lrclib.net at request time.
 *
 * Deliberately *not* committed to the repo. Song lyrics are copyrighted, and
 * checking a full set into a public repository — then serving them from our
 * own origin as page content — is redistribution. This route does what the
 * desktop app does: asks lrclib for them on demand, exactly as
 * Linea/src/main/lyrics.ts does. Nothing is stored.
 *
 * If lrclib has no match, the demo falls back to the original placeholder
 * lines in lyrics.ts, so the panel is never empty.
 */

const REVALIDATE_SECONDS = 86_400

export async function GET() {
  const params = new URLSearchParams({
    track_name: DEMO_TRACK.title,
    artist_name: DEMO_TRACK.artist
  })

  try {
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: {
        // lrclib asks clients to identify themselves.
        'User-Agent': 'Linea Website (https://github.com/Meet2304/Project-Linea)'
      },
      next: { revalidate: REVALIDATE_SECONDS }
    })

    if (!res.ok) return NextResponse.json({ lines: null as LyricLine[] | null })

    const data = (await res.json()) as { syncedLyrics?: string; duration?: number }
    const lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : null

    return NextResponse.json(
      {
        lines: lines && lines.length > 2 ? lines : null,
        durationMs: data.duration ? Math.round(data.duration * 1000) : undefined
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=604800`
        }
      }
    )
  } catch {
    // Network failure — the demo keeps its fallback lines.
    return NextResponse.json({ lines: null })
  }
}
