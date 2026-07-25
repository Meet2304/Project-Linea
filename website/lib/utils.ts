/**
 * `cn` — the class-name joiner the vendored Animate UI components import.
 *
 * shadcn's own version is `twMerge(clsx(...))`, which exists to resolve
 * conflicts between Tailwind utility classes. Nothing here needs that: the
 * site styles with CSS modules and inline styles, and the only classes
 * these components join are a caller's own and one constant of their own,
 * so tailwind-merge would be a no-op and two dependencies.
 *
 * Takes `unknown` because motion types a `className` as possibly being a
 * MotionValue rather than a string. Only strings and numbers can name a
 * class, so anything else is dropped rather than stringified into nonsense.
 */
export function cn(...classes: unknown[]): string {
  return classes
    .filter((c): c is string | number => typeof c === 'string' || typeof c === 'number')
    .join(' ')
}
