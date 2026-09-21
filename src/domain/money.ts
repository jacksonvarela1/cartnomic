// Money is integer cents everywhere. Rounding happens only at documented boundaries.

/** Documented rounding rule: half up (ties go toward positive infinity). */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('roundHalfUp needs a finite number')
  return Math.floor(value + 0.5)
}

export function formatCents(cents: number | null | undefined, fallback = 'Not available'): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return fallback
  const negative = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100).toLocaleString('en-US')
  const remainder = String(abs % 100).padStart(2, '0')
  const body = '$' + dollars + '.' + remainder
  return negative ? '-' + body : body
}

export function formatSignedCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'Not available'
  if (cents > 0) return '+' + formatCents(cents)
  return formatCents(cents)
}

/** Parses user input such as 4.50 or $4.50 into integer cents. Blank is null, never zero. */
export function parseDollarsToCents(raw: string): { cents: number | null; error: string | null } {
  const trimmed = raw.trim()
  if (trimmed === '') return { cents: null, error: null }
  const cleaned = trimmed.replace(/[$,\s]/g, '')
  if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.' || cleaned === '-') {
    return { cents: null, error: 'Enter an amount like 4.50' }
  }
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return { cents: null, error: 'Enter an amount like 4.50' }
  const decimals = cleaned.split('.')[1]
  if (decimals && decimals.length > 2) return { cents: null, error: 'Use at most two decimal places' }
  return { cents: roundHalfUp(value * 100), error: null }
}

export function percent(numerator: number, denominator: number, decimals = 1): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  const factor = 10 ** decimals
  return Math.round((numerator / denominator) * 100 * factor) / factor
}
