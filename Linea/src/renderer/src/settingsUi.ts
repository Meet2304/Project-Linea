import type { LyricsSize, Prefs, Theme } from '../../shared/types'
import { el } from './playerUi'
import { icons } from './icons'

export interface SettingsCallbacks {
  onTheme: (theme: Theme) => void
  onClickThrough: () => void
  onOpacity: (value: number) => void
  onLyricsSize: (size: LyricsSize) => void
  onLyricsExpanded: (expanded: boolean) => void
  onDisconnect: () => void
  /** Fires after the now/settings view swaps. */
  onViewChange: () => void
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const themeSwitch = byId<HTMLButtonElement>('set-theme')
const clickThroughSwitch = byId<HTMLButtonElement>('set-clickthrough')
const opacitySlider = byId<HTMLInputElement>('set-opacity')
const sizeSegs = Array.from(document.querySelectorAll<HTMLButtonElement>('.seg'))
const lyricsSwitch = byId<HTMLButtonElement>('set-lyrics')
const closeBtn = byId<HTMLButtonElement>('set-close')
const disconnectBtn = byId<HTMLButtonElement>('set-disconnect')

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

function updateSliderFill(slider: HTMLInputElement): void {
  const min = Number(slider.min)
  const max = Number(slider.max)
  const ratio = max > min ? (Number(slider.value) - min) / (max - min) : 0
  slider.style.setProperty('--fill', String(ratio * 100))
}

export function initSettings(cb: SettingsCallbacks): void {
  onViewChange = cb.onViewChange

  closeBtn.innerHTML = icons.x

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
  opacitySlider.addEventListener('input', () => {
    updateSliderFill(opacitySlider)
    cb.onOpacity(Number(opacitySlider.value))
  })
  sizeSegs.forEach((seg) => {
    seg.addEventListener('click', () => {
      const size = seg.dataset.size as LyricsSize
      reflectSize(size)
      cb.onLyricsSize(size)
    })
  })
  lyricsSwitch.addEventListener('click', () => {
    const expanded = !isOn(lyricsSwitch)
    setOn(lyricsSwitch, expanded)
    cb.onLyricsExpanded(expanded)
  })
  closeBtn.addEventListener('click', () => closeSettings())
  disconnectBtn.addEventListener('click', () => {
    closeSettings()
    cb.onDisconnect()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings()
  })
}

export function reflectPrefs(prefs: Prefs): void {
  setOn(themeSwitch, prefs.theme === 'dark')
  setOn(lyricsSwitch, prefs.lyricsExpanded)
  opacitySlider.value = String(prefs.opacity)
  updateSliderFill(opacitySlider)
  reflectSize(prefs.lyricsSize)
}

export function reflectClickThrough(on: boolean): void {
  setOn(clickThroughSwitch, on)
}

function setSettingsOpen(open: boolean): void {
  el.settingsView.hidden = !open
  el.nowView.hidden = open
  el.btnSettings.dataset.active = String(open)
  onViewChange()
}

export function toggleSettings(): void {
  setSettingsOpen(el.settingsView.hidden)
}

export function closeSettings(): void {
  if (!el.settingsView.hidden) setSettingsOpen(false)
}
