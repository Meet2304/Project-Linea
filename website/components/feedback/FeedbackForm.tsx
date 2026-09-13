'use client'

import { useState } from 'react'
import Mono from '@/components/ui/Mono'
import { MIN_MESSAGE } from '@/lib/report'
import s from './feedback.module.css'

type Kind = 'problem' | 'idea'
type Status =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

const PLACEHOLDER: Record<Kind, string> = {
  problem: 'What broke, in a sentence.',
  idea: 'What would this change while a song is playing?'
}

export default function FeedbackForm() {
  const [kind, setKind] = useState<Kind>('problem')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function send(): Promise<void> {
    if (message.trim().length < MIN_MESSAGE) {
      setStatus({ kind: 'error', message: 'A short sentence is enough.' })
      return
    }
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, company })
      })
      const data: unknown = await res.json().catch(() => null)
      if (res.ok) {
        setMessage('')
        setStatus({ kind: 'sent' })
        return
      }
      const error =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Could not send.'
      setStatus({ kind: 'error', message: error })
    } catch {
      setStatus({ kind: 'error', message: 'Could not send.' })
    }
  }

  return (
    <form
      className={s.form}
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <fieldset className={s.kinds}>
        <legend className="sr-only">What kind of report</legend>
        <KindButton
          label="Problem"
          hint="Something broke"
          selected={kind === 'problem'}
          onSelect={() => {
            setKind('problem')
            if (status.kind !== 'idle') setStatus({ kind: 'idle' })
          }}
        />
        <KindButton
          label="Idea"
          hint="Not a bug"
          selected={kind === 'idea'}
          onSelect={() => {
            setKind('idea')
            if (status.kind !== 'idle') setStatus({ kind: 'idle' })
          }}
        />
      </fieldset>

      <label className={s.honey} aria-hidden="true">
        Company
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </label>

      <label className={s.field}>
        <Mono color="var(--steel)">{kind === 'idea' ? 'The idea' : 'What happened'}</Mono>
        <textarea
          className={`${s.input} ${s.area}`}
          name="message"
          rows={6}
          maxLength={2000}
          required
          value={message}
          placeholder={PLACEHOLDER[kind]}
          onChange={(event) => {
            setMessage(event.target.value)
            if (status.kind !== 'idle') setStatus({ kind: 'idle' })
          }}
        />
      </label>

      <p className={s.note}>
        Send files a GitHub issue. Linea itself attaches the session when you report from settings.
        Don&apos;t include passwords or API keys.
      </p>

      <div className={s.actions}>
        <button className={s.primary} type="submit" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>

      {status.kind === 'sent' ? (
        <p className={s.status} role="status">
          Sent.
        </p>
      ) : null}
      {status.kind === 'error' ? (
        <p className={s.statusError} role="alert">
          {status.message}
        </p>
      ) : null}
    </form>
  )
}

function KindButton({
  label,
  hint,
  selected,
  onSelect
}: {
  label: string
  hint: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={s.kind}
      data-selected={selected}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={s.kindLabel}>{label}</span>
      <Mono color={selected ? 'var(--text-on-accent)' : 'var(--slate)'}>{hint}</Mono>
    </button>
  )
}
