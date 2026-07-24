/**
 * The mono micro-label: Space Mono, uppercase, opened-up tracking. Used for
 * eyebrows (`// like this`), frequencies, timecodes and section numbers —
 * the lab/measurement flavor the brand runs on.
 */
export default function Mono({
  children,
  color = 'var(--text-faint)',
  tracking = '0.16em',
  className,
  style
}: {
  children: React.ReactNode
  color?: string
  tracking?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-2xs)',
        letterSpacing: tracking,
        textTransform: 'uppercase',
        color,
        transition: 'color 420ms var(--ease)',
        ...style
      }}
    >
      {children}
    </span>
  )
}
