import type { LyricsSize, Prefs, Theme } from '../../shared/types'
import { parseUserReport, type UserReportKind } from '../../shared/report'
import { el } from './playerUi'

export interface SettingsCallbacks {
  onTheme: (theme: Theme) => void
  onLyricsSize: (size: LyricsSize) => void
  onShowTimestamps: (show: boolean) => void
  /** Fires after the now/settings view swaps. */
  onViewChange?: () => void
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const themeSwitch = byId<HTMLButtonElement>('set-theme')
const sizeSegs = Array.from(document.querySelectorAll<HTMLButtonElement>('.seg'))
const timestampsSwitch = byId<HTMLButtonElement>('set-timestamps')
const settingsScroll = byId('settings-scroll')
const settingsScrollWrap = byId('settings-scroll-wrap')
const reportOpen = byId<HTMLButtonElement>('report-problem')
const reportComposer = byId<HTMLFormElement>('report-composer')
const reportMessage = byId<HTMLTextAreaElement>('report-message')
const reportSend = byId<HTMLButtonElement>('report-send')
const reportCancel = byId<HTMLButtonElement>('report-cancel')
const reportStatus = byId('report-status')
const reportKinds = Array.from(document.querySelectorAll<HTMLButtonElement>('.report-kind'))

let onViewChange: () => void = () => {}
let reportKind: UserReportKind = 'problem'
let composerOpen = false

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

function setReportStatus(kind: 'ok' | 'error' | 'pending', text: string): void {
  reportStatus.hidden = false
  reportStatus.dataset.kind = kind
  reportStatus.textContent = text
}

function setComposerOpen(open: boolean): void {
  composerOpen = open
  reportComposer.hidden = !open
  reportOpen.setAttribute('aria-expanded', String(open))
  if (open) {
    reportStatus.hidden = true
    reportStatus.textContent = ''
    requestAnimationFrame(() => {
      reportMessage.focus()
      updateSettingsScrollFades()
    })
  } else {
    updateSettingsScrollFades()
  }
}

function closeComposer(): boolean {
  if (!composerOpen) return false
  setComposerOpen(false)
  return true
}

function wireReportComposer(): void {
  reportOpen.addEventListener('click', () => {
    setComposerOpen(reportComposer.hidden)
  })
  reportCancel.addEventListener('click', () => setComposerOpen(false))
  reportKinds.forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.kind
      if (kind !== 'problem' && kind !== 'idea') return
      reportKind = kind
      reportKinds.forEach((chip) => {
        chip.dataset.selected = String(chip === btn)
      })
    })
  })
  reportComposer.addEventListener('submit', (event) => {
    event.preventDefault()
    void sendReport()
  })
}

async function sendReport(): Promise<void> {
  const parsed = parseUserReport({ kind: reportKind, message: reportMessage.value })
  if (!parsed) {
    setReportStatus('error', 'A short sentence is enough.')
    return
  }
  reportSend.disabled = true
  setReportStatus('pending', 'Sending…')
  try {
    const result = await window.linea.submitReport(parsed)
    if (result.ok) {
      reportMessage.value = ''
      setReportStatus('ok', 'Sent.')
    } else {
      setReportStatus('error', result.error ?? 'Could not send.')
    }
  } catch {
    setReportStatus('error', 'Could not send.')
  } finally {
    reportSend.disabled = false
  }
}

export function initSettings(cb: SettingsCallbacks): void {
  if (cb.onViewChange) onViewChange = cb.onViewChange

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

  wireReportComposer()

  settingsScroll.addEventListener('scroll', updateSettingsScrollFades, { passive: true })
  new ResizeObserver(updateSettingsScrollFades).observe(settingsScroll)

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (closeComposer()) {
      event.preventDefault()
      return
    }
    closeSettings()
  })
}

export function reflectPrefs(prefs: Prefs): void {
  setOn(themeSwitch, prefs.theme === 'dark')
  setOn(timestampsSwitch, prefs.showTimestamps)
  reflectSize(prefs.lyricsSize)
}

function setSettingsOpen(open: boolean): void {
  if (!open) setComposerOpen(false)
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
