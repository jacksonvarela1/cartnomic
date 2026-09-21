interface LogoProps {
  size?: number
  variant?: 'light' | 'dark' | 'mono'
  title?: string
}

/**
 * Original CartNomic mark: a cart frame holding three bars. Drawn as vectors so it stays crisp at
 * 16, 32 and 64 px. No leaf, no retailer icon, no cropped raster from the reference boards.
 */
export function LogoMark({ size = 32, variant = 'dark', title = 'CartNomic' }: LogoProps) {
  const frame = variant === 'mono' ? 'currentColor' : variant === 'light' ? '#A7F3D0' : '#0B1F1A'
  const bars = variant === 'mono' ? 'currentColor' : variant === 'light' ? '#22C55E' : '#146C43'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} focusable="false">
      <g fill="none" stroke={frame} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13h7.5l6 27h27" />
        <path d="M19.5 33h27l4.5-17H16" />
      </g>
      <g fill={bars}>
        <rect x="24" y="24" width="5" height="6" rx="1.5" />
        <rect x="33" y="19" width="5" height="11" rx="1.5" />
        <rect x="42" y="14" width="5" height="16" rx="1.5" />
      </g>
      <circle cx="26" cy="49" r="4" fill={frame} />
      <circle cx="43" cy="49" r="4" fill={frame} />
    </svg>
  )
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="brand-name">
      <span style={{ color: light ? '#F8FAF7' : '#0B1F1A' }}>Cart</span>
      <span className="nomic" style={{ color: light ? '#A7F3D0' : '#146C43' }}>Nomic</span>
    </span>
  )
}
