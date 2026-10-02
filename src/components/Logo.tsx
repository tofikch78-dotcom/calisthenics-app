import { useId } from 'react'

/**
 * The app's mark: the lightning bolt from the uploaded logo, on its white tile.
 *
 * Inlined rather than referenced so it renders on the first paint and needs no
 * network fetch, which is what keeps the offline launch honest. The geometry and
 * the gradient are the ones `npm run icons` writes into `public/icon.svg`, so
 * the header, the splash screen and the installed icon are all the same artwork.
 */
export function Logo({ className }: { className?: string }) {
  // The gradient is the only part that needs an id, and useId keeps it unique if
  // the mark ever appears more than once on a page.
  const gradientId = useId()
  return (
    <svg viewBox="0 0 512 512" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="94.03"
          y1="69.45"
          x2="447.98"
          y2="123.75"
        >
          <stop offset="0" stopColor="#a53aff" />
          <stop offset="1" stopColor="#746eff" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#ffffff" />
      <path
        fill={`url(#${gradientId})`}
        d="M145.65 58.85L405.33 58.85L314.02 191.28L460.8 191.28L255.99 453.15L254.61 322.43L126.29 322.43L215.22 191.28L51.2 191.28Z"
      />
    </svg>
  )
}