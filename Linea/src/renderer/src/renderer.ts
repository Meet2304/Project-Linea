import { getCurrentLineIndex, estimatePositionMs } from '../../shared/lyrics'
import type { LyricLine } from '../../shared/lyrics'
import type { NowPlaying } from '../../shared/types'

const statusEl = document.getElementById('status')!
const authBtn = document.getElementById('auth-btn') as HTMLButtonElement
const clickThroughBtn = document.getElementById('click-through-btn') as HTMLButtonElement
const lyricEl = document.getElementById('lyric')!
const prevEl = document.getElementById('lyric-prev')!
const nextEl = document.getElementById('lyric-next')!
const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement
const fontSlider = document.getElementById('font-slider') as HTMLInputElement

let currentLines: LyricLine[] = []
let latestNowPlaying: NowPlaying | null = null
let connected = false

function setStatus(text: string): void {
  statusEl.textContent = text
}

function applyPrefs(opacity: number, fontSize: number): void {
  document.body.style.opacity = String(opacity)
  lyricEl.style.fontSize = `${fontSize}px`
  opacitySlider.value = String(opacity)
  fontSlider.value = String(fontSize)
}

function updateAuthUi(isConnected: boolean): void {
  connected = isConnected
  authBtn.textContent = isConnected ? 'Disconnect' : 'Connect Spotify'
  if (!isConnected) {
    setStatus('Not connected')
    lyricEl.textContent = 'Connect Spotify to begin'
    prevEl.textContent = ''
    nextEl.textContent = ''
  } else if (!latestNowPlaying) {
    setStatus('Connected')
    lyricEl.textContent = 'Play a song on Spotify'
  }
}

async function refreshAuthState(): Promise<void> {
  const isConnected = await window.linea.getAuthState()
  updateAuthUi(isConnected)
}

authBtn.addEventListener('click', async () => {
  try {
    if (connected) {
      await window.linea.logout()
      latestNowPlaying = null
      currentLines = []
      updateAuthUi(false)
      return
    }

    authBtn.disabled = true
    setStatus('Waiting for Spotify…')
    const ok = await window.linea.login()
    updateAuthUi(ok)
    if (ok) setStatus('Connected')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    setStatus(message)
    updateAuthUi(false)
  } finally {
    authBtn.disabled = false
  }
})

clickThroughBtn.addEventListener('click', async () => {
  const isClickThrough = await window.linea.toggleClickThrough()
  clickThroughBtn.textContent = isClickThrough ? 'Click-through ON' : 'Click-through'
})

window.linea.onLyricsUpdate((lines) => {
  currentLines = lines
  if (lines.length === 0 && latestNowPlaying) {
    lyricEl.textContent = 'No synced lyrics for this track'
    prevEl.textContent = ''
    nextEl.textContent = ''
  }
})

window.linea.onNowPlaying((data) => {
  latestNowPlaying = data
  if (!connected) return

  if (!data) {
    setStatus('Connected · Nothing playing')
    lyricEl.textContent = 'Play a song on Spotify'
    prevEl.textContent = ''
    nextEl.textContent = ''
    return
  }

  const playingLabel = data.isPlaying ? 'Playing' : 'Paused'
  setStatus(`${playingLabel} · ${data.trackName} — ${data.artistName}`)
})

function renderCurrentLine(): void {
  if (latestNowPlaying && currentLines.length > 0) {
    const positionMs = estimatePositionMs(latestNowPlaying)
    const index = getCurrentLineIndex(currentLines, positionMs)
    lyricEl.textContent = currentLines[index]?.text ?? ''
    prevEl.textContent = currentLines[index - 1]?.text ?? ''
    nextEl.textContent = currentLines[index + 1]?.text ?? ''
  }
  requestAnimationFrame(renderCurrentLine)
}
requestAnimationFrame(renderCurrentLine)

window.linea.getPrefs().then((prefs) => {
  applyPrefs(prefs.opacity, prefs.fontSize)
})

opacitySlider.addEventListener('input', async () => {
  const prefs = await window.linea.setPrefs({ opacity: Number(opacitySlider.value) })
  document.body.style.opacity = String(prefs.opacity)
})

fontSlider.addEventListener('input', async () => {
  const prefs = await window.linea.setPrefs({ fontSize: Number(fontSlider.value) })
  lyricEl.style.fontSize = `${prefs.fontSize}px`
})

void refreshAuthState()
