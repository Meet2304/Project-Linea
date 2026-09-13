'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Mono from '@/components/ui/Mono'
import {
  FEEDBACK_KINDS,
  KIND_COPY,
  draftFromSearch,
  githubIssueUrl,
  issueBody,
  issueTitle,
  reportLooksReady,
  type FeedbackDraft,
  type FeedbackKind
} from '@/lib/feedback'
import s from './feedback.module.css'

type Status = { kind: 'idle' } | { kind: 'copied' } | { kind: 'error'; message: string }

export default function FeedbackForm() {
  const searchParams = useSearchParams()
  const initial = useMemo(() => draftFromSearch(searchParams.toString()), [searchParams])
  const [draft, setDraft] = useState<FeedbackDraft>(initial)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    setDraft(initial)
  }, [initial])

  function patch<K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    if (status.kind !== 'idle') setStatus({ kind: 'idle' })
  }

  function fileOnGitHub(): void {
    if (!reportLooksReady(draft)) {
      setStatus({
        kind: 'error',
        message: 'A sentence about what happened is enough — twelve characters, at least.'
      })
      return
    }
    const url = githubIssueUrl(draft)
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) window.location.assign(url)
  }

  async function copyReport(): Promise<void> {
    const text = `${issueTitle(draft)}\n\n${issueBody(draft)}`
    try {
      await navigator.clipboard.writeText(text)
      setStatus({ kind: 'copied' })
    } catch {
      setStatus({ kind: 'error', message: "Couldn't copy. Select the form and copy it yourself." })
    }
  }

  const fromApp = Boolean(initial.version || initial.song || initial.player || initial.source)

  return (
    <form
      className={s.form}
      onSubmit={(event) => {
        event.preventDefault()
        fileOnGitHub()
      }}
    >
      <fieldset className={s.kinds}>
        <legend className="sr-only">What kind of report</legend>
        {FEEDBACK_KINDS.map((kind) => (
          <KindButton
            key={kind}
            kind={kind}
            selected={draft.kind === kind}
            onSelect={() => patch('kind', kind)}
          />
        ))}
      </fieldset>

      {fromApp ? (
        <p className={s.banner}>
          Linea filled in this session. Add what went wrong — that is the part I cannot see.
        </p>
      ) : null}

      <label className={s.field}>
        <Mono color="var(--steel)">Title</Mono>
        <input
          className={s.input}
          type="text"
          name="title"
          maxLength={120}
          value={draft.title}
          placeholder={KIND_COPY[draft.kind].defaultTitle}
          onChange={(event) => patch('title', event.target.value)}
        />
      </label>

      <label className={s.field}>
        <Mono color="var(--steel)">What happened</Mono>
        <textarea
          className={`${s.input} ${s.area}`}
          name="what"
          rows={5}
          maxLength={2000}
          required
          value={draft.what}
          placeholder={KIND_COPY[draft.kind].placeholder}
          onChange={(event) => patch('what', event.target.value)}
        />
      </label>

      <div className={s.grid}>
        <label className={s.field}>
          <Mono color="var(--steel)">Windows</Mono>
          <input
            className={s.input}
            type="text"
            name="windows"
            maxLength={200}
            value={draft.windows}
            placeholder="Windows 11, 24H2"
            onChange={(event) => patch('windows', event.target.value)}
          />
        </label>
        <label className={s.field}>
          <Mono color="var(--steel)">Player</Mono>
          <input
            className={s.input}
            type="text"
            name="player"
            maxLength={200}
            value={draft.player}
            placeholder="Spotify, Chrome, VLC…"
            onChange={(event) => patch('player', event.target.value)}
          />
        </label>
        <label className={s.field}>
          <Mono color="var(--steel)">Song</Mono>
          <input
            className={s.input}
            type="text"
            name="song"
            maxLength={300}
            value={draft.song}
            placeholder="Title — Artist"
            onChange={(event) => patch('song', event.target.value)}
          />
        </label>
        <label className={s.field}>
          <Mono color="var(--steel)">Linea version</Mono>
          <input
            className={s.input}
            type="text"
            name="version"
            maxLength={40}
            value={draft.version}
            placeholder="0.2.0"
            onChange={(event) => patch('version', event.target.value)}
          />
        </label>
      </div>

      {draft.kind !== 'idea' ? (
        <label className={s.field}>
          <Mono color="var(--steel)">What still works</Mono>
          <input
            className={s.input}
            type="text"
            name="controls"
            maxLength={300}
            value={draft.controls}
            placeholder="Play, next, seek, lyrics…"
            onChange={(event) => patch('controls', event.target.value)}
          />
        </label>
      ) : null}

      {draft.kind !== 'idea' ? (
        <label className={s.field}>
          <Mono color="var(--steel)">Steps</Mono>
          <textarea
            className={`${s.input} ${s.area}`}
            name="steps"
            rows={4}
            maxLength={2000}
            value={draft.steps}
            placeholder="What you did, in order."
            onChange={(event) => patch('steps', event.target.value)}
          />
        </label>
      ) : null}

      <p className={s.note}>
        This opens GitHub with the report filled in. You need an account to send it — that is how
        these stay next to the rest of Linea&apos;s work. Nothing here is stored on this site.
        Don&apos;t include passwords or API keys.
      </p>

      <div className={s.actions}>
        <button className={s.primary} type="submit">
          File on GitHub
        </button>
        <button className={s.ghost} type="button" onClick={() => void copyReport()}>
          Copy the report
        </button>
      </div>

      {status.kind === 'copied' ? (
        <p className={s.status} role="status">
          Copied. Paste it anywhere I will actually see it.
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
  kind,
  selected,
  onSelect
}: {
  kind: FeedbackKind
  selected: boolean
  onSelect: () => void
}) {
  const copy = KIND_COPY[kind]
  return (
    <button
      type="button"
      className={s.kind}
      data-selected={selected}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={s.kindLabel}>{copy.label}</span>
      <Mono color={selected ? 'var(--text-on-accent)' : 'var(--slate)'}>{copy.hint}</Mono>
    </button>
  )
}
