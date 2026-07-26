'use client'

import { useEffect, useRef } from 'react'
import { mountField, type FieldInstance, type FieldOptions } from './cymatics-live'

interface Props extends Omit<FieldOptions, 'pointerHost'> {
  className?: string
  /**
   * Listen for the pointer on this element instead of the canvas. Passed as a
   * ref because the host is usually an ancestor that only exists once React
   * has committed — refs are attached before effects run, so it is populated
   * by the time the field mounts.
   */
  pointerHostRef?: React.RefObject<HTMLElement | null>
  /**
   * Changing this remounts the engine. Keep it out of the color props —
   * colors go through setColors() so a palette change never flashes.
   */
  patternKey?: string | number
  /**
   * Park the loop without unmounting. The feature scroller stacks one
   * instance per act and crossfades between them; the ones at zero opacity
   * are still on screen as far as the IntersectionObserver is concerned, so
   * they have to be told explicitly to stop.
   */
  paused?: boolean
}

/**
 * A live cymatic plate rendered behind whatever sits on top of it.
 *
 * Colors are applied imperatively: the feature scroller crossfades palettes
 * between acts, and remounting the canvas for that would blink.
 */
export default function CymaticField({
  className,
  patternKey,
  paused,
  pointerHostRef,
  ...opts
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const instRef = useRef<FieldInstance | null>(null)

  // Read the latest options without making them a mount dependency.
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const inst = mountField(host, {
      ...optsRef.current,
      pointerHost: pointerHostRef?.current ?? null
    })
    instRef.current = inst
    return () => {
      inst.destroy()
      instRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternKey, opts.style, opts.n, opts.m, opts.scale, opts.seed])

  useEffect(() => {
    instRef.current?.setColors(opts.color ?? '#1a1a1e', opts.color2 ?? null)
  }, [opts.color, opts.color2])

  useEffect(() => {
    const inst = instRef.current
    if (!inst) return
    if (paused) inst.pause()
    else inst.resume()
  }, [paused])

  return <div ref={hostRef} className={className} aria-hidden="true" />
}
