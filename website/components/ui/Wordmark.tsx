/**
 * The Linea logotype. There is no logo asset — the brand is set in type:
 * lowercase "linea" in Outfit with tightened tracking, plus one filled dot
 * standing in for a wave source.
 */
export default function Wordmark({
  size = 26,
  color = 'var(--ink)',
  dotColor
}: {
  size?: number
  color?: string
  dotColor?: string
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        color,
        display: 'inline-flex',
        alignItems: 'baseline',
        userSelect: 'none'
      }}
    >
      linea
      <span
        aria-hidden="true"
        style={{
          width: size * 0.14,
          height: size * 0.14,
          borderRadius: '50%',
          background: dotColor ?? color,
          display: 'inline-block',
          marginLeft: size * 0.06,
          transform: `translateY(-${size * 0.02}px)`,
          transition: 'background 420ms var(--ease)'
        }}
      />
    </span>
  )
}
