import type { LyricsSize, Prefs, Theme } from '../../shared/types'
import { el, showToast } from './playerUi'

export interface SettingsCallbacks {
  onTheme: (theme: Theme) => void
  onLyricsSize: (size: LyricsSize) => void
  onShowTimestamps: (show: boolean) => void
  /** Fires after the now/settings view swaps. */
  onViewChange: () => void
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const themeSwitch = byId<HTMLButtonElement>('set-theme')
const sizeSegs = Array.from(document.querySelectorAll<HTMLButtonElement>('.seg'))
const timestampsSwitch = byId<HTMLButtonElement>('set-timestamps')
const settingsScroll = byId('settings-scroll')
const settingsScrollWrap = byId('settings-scroll-wrap')

let onViewChange: () => void = () => {}

function reflectSize(size: LyricsSize): void {
  sizeSegs.forEach((seg) => {
    seg.dataset.active = String(seg.dataset.size === size)
  })
}

function isOn(node: HTMLElement): boolean {
  return node.getAttribute('aria-checked') === 'true'
}

function setOn(node: HTMLElement, on: boolean): void {
  node.setAttribute('aria-checked', String(on))
}

/** Top/bottom fade cues so it's obvious settings scroll (mirrors lyrics). */
function updateSettingsScrollFades(): void {
  const s = settingsScroll
  settingsScrollWrap.dataset.up = String(s.scrollTop > 2)
  settingsScrollWrap.dataset.down = String(s.scrollTop + s.clientHeight < s.scrollHeight - 2)
}

export function initSettings(cb: SettingsCallbacks): void {
  onViewChange = cb.onViewChange
  byId('set-media-access').hidden = window.linea.platform !== 'darwin'
  const access = byId<HTMLButtonElement>('btn-media-access')
  access.addEventListener('click', async () => {
    access.disabled = true
    try {
      const result = await window.linea.requestMediaAccess()
      access.title = result.ok
        ? 'Access requested for the running player'
        : 'Enable Linea in System Settings > Privacy & Security > Automation'
      access.textContent = result.ok ? 'Allow' : 'Retry'
      if (!result.ok)
        showToast(
          result.reason === 'session_unavailable'
            ? 'Start Spotify or Music before allowing access'
            : 'Enable Linea in System Settings > Privacy & Security > Automation'
        )
    } catch {
      showToast('Music access could not be requested. Try again.')
    } finally {
      access.disabled = false
    }
  })

  themeSwitch.addEventListener('click', () => {
    const dark = !isOn(themeSwitch)
    setOn(themeSwitch, dark)
    cb.onTheme(dark ? 'dark' : 'light')
  })
  sizeSegs.forEach((seg) => {
    seg.addEventListener('click', () => {
      const size = seg.dataset.size as LyricsSize
      reflectSize(size)
      cb.onLyricsSize(size)
    })
  })
  timestampsSwitch.addEventListener('click', () => {
    const show = !isOn(timestampsSwitch)
    setOn(timestampsSwitch, show)
    cb.onShowTimestamps(show)
  })

  settingsScroll.addEventListener('scroll', updateSettingsScrollFades, { passive: true })
  new ResizeObserver(updateSettingsScrollFades).observe(settingsScroll)

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings()
  })
}

export function reflectPrefs(prefs: Prefs): void {
  setOn(themeSwitch, prefs.theme === 'dark')
  setOn(timestampsSwitch, prefs.showTimestamps)
  reflectSize(prefs.lyricsSize)
}

function setSettingsOpen(open: boolean): void {
  el.settingsView.hidden = !open
  el.nowView.hidden = open
  el.btnSettings.dataset.active = String(open)
  el.btnSettings.setAttribute('aria-pressed', String(open))
  el.app.dataset.settings = String(open)
  onViewChange()
  if (open) {
    // Measure after the view is shown and laid out.
    requestAnimationFrame(updateSettingsScrollFades)
  }
}

export function toggleSettings(): void {
  setSettingsOpen(el.settingsView.hidden)
}

/** The update badge wants "open", not "toggle" — it is never a latch. */
export function openSettings(): void {
  if (el.settingsView.hidden) setSettingsOpen(true)
}

export function closeSettings(): void {
  if (!el.settingsView.hidden) setSettingsOpen(false)
}
