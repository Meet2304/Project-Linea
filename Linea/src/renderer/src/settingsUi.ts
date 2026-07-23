import type { LyricsSize, Prefs, Theme } from '../../shared/types'
import { el } from './playerUi'

export interface SettingsCallbacks {
  onTheme: (theme: Theme) => void
  onClickThrough: () => void
  onLyricsSize: (size: LyricsSize) => void
  onShowTimestamps: (show: boolean) => void
  onDisconnect: () => void
  /** Fires after the now/settings view swaps. */
  onViewChange: () => void
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const themeSwitch = byId<HTMLButtonElement>('set-theme')
const clickThroughSwitch = byId<HTMLButtonElement>('set-clickthrough')
const sizeSegs = Array.from(document.querySelectorAll<HTMLButtonElement>('.seg'))
const timestampsSwitch = byId<HTMLButtonElement>('set-timestamps')
const disconnectBtn = byId<HTMLButtonElement>('set-disconnect')
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

  themeSwitch.addEventListener('click', () => {
    const dark = !isOn(themeSwitch)
    setOn(themeSwitch, dark)
    cb.onTheme(dark ? 'dark' : 'light')
  })
  clickThroughSwitch.addEventListener('click', () => {
    // State is owned by main (global shortcut can also toggle it);
    // reflectClickThrough() applies the authoritative value.
    cb.onClickThrough()
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
  disconnectBtn.addEventListener('click', () => {
    closeSettings()
    cb.onDisconnect()
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

export function reflectClickThrough(on: boolean): void {
  setOn(clickThroughSwitch, on)
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

export function closeSettings(): void {
  if (!el.settingsView.hidden) setSettingsOpen(false)
}
