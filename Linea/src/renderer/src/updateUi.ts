import type { UpdateState } from '../../shared/types'
import { el, showToast } from './playerUi'

/**
 * Two surfaces, one state: a topbar badge that only appears once an update is
 * actionable, and a settings row that narrates every state. The badge follows
 * the usual topbar hover rule, so it stays invisible during normal playback —
 * the toast below is what actually tells the user something is waiting.
 */

/** Only ever toast once per offered version, so a re-check can't nag. */
let toastedVersion: string | null = null

export function initUpdateUi(cb: { onOpenSettings: () => void }): void {
  el.btnUpdate.addEventListener('click', () => cb.onOpenSettings())

  el.updateAction.addEventListener('click', () => {
    // The button's job changes with the state; dataset.action says which.
    if (el.updateAction.dataset.action === 'install') {
      void window.linea.installUpdate()
    } else {
      void window.linea.checkForUpdate()
    }
  })
}

function setAction(label: string, action: 'check' | 'install', disabled: boolean): void {
  el.updateAction.textContent = label
  el.updateAction.dataset.action = action
  el.updateAction.disabled = disabled
  el.updateAction.dataset.primary = String(action === 'install')
}

function setProgress(percent: number | null): void {
  el.updateProgress.hidden = percent === null
  if (percent !== null) el.updateProgress.style.setProperty('--fill', String(percent))
}

export function reflectUpdateState(state: UpdateState): void {
  const actionable = state.status === 'ready' || state.status === 'manual'
  el.btnUpdate.hidden = !actionable
  setProgress(state.status === 'downloading' ? state.percent : null)

  switch (state.status) {
    case 'idle':
      el.updateTitle.textContent = `Linea ${state.version}`
      el.updateHint.textContent = 'Up to date'
      setAction('Check', 'check', false)
      break
    case 'checking':
      el.updateTitle.textContent = `Linea ${state.version}`
      el.updateHint.textContent = 'Checking…'
      setAction('Check', 'check', true)
      break
    case 'downloading':
      el.updateTitle.textContent = `Linea ${state.version}`
      el.updateHint.textContent = `Downloading ${state.next}… ${state.percent}%`
      setAction('Check', 'check', true)
      break
    case 'ready':
      el.updateTitle.textContent = `Version ${state.next} is ready`
      el.updateHint.textContent = 'Restart to finish updating'
      setAction('Restart & update', 'install', false)
      el.btnUpdate.setAttribute('aria-label', `Update to ${state.next}`)
      break
    case 'manual':
      el.updateTitle.textContent = `Version ${state.next} is available`
      el.updateHint.textContent = 'Download it from GitHub'
      setAction('Download', 'install', false)
      el.btnUpdate.setAttribute('aria-label', `Download version ${state.next}`)
      break
    case 'error':
      el.updateTitle.textContent = `Linea ${state.version}`
      el.updateHint.textContent = "Couldn't check for updates"
      setAction('Retry', 'check', false)
      break
  }

  if (actionable && toastedVersion !== state.next) {
    toastedVersion = state.next
    showToast(
      state.status === 'ready'
        ? `Update ${state.next} is ready — open settings to restart`
        : `Update ${state.next} is available — open settings to download`
    )
  }
}
