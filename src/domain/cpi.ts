// CPI math. Every calculation uses matching calendar months and preserves source nulls.

export interface CpiSeriesMeta {
  series_id: string
  label: string
  producer: string
  distributor: string
  source_url: string
  original_release_url: string
  geography: string
  population: string
  seasonal_adjustment: string
  frequency: string
  unit: string
  retrieved_on: string
}

export interface CpiObservation {
  series_id: string
  category: string
  period: string // YYYY-MM
  index_value: number | null
  source_missing: boolean
  source_url: string
  retrieved_on: string
}

export interface CpiSnapshot {
  schema_version: number
  status: string
  retrieved_on: string
  coverage_start: string
  coverage_end: string
  missing_policy: string
  series: CpiSeriesMeta[]
  observations: CpiObservation[]
}

export interface SeriesView {
  meta: CpiSeriesMeta
  periods: string[]
  values: Array<number | null>
  byPeriod: Map<string, number | null>
}

export function buildSeriesViews(snapshot: CpiSnapshot): Map<string, SeriesView> {
  const out = new Map<string, SeriesView>()
  for (const meta of snapshot.series) {
    const rows = snapshot.observations
      .filter((o) => o.series_id === meta.series_id)
      .sort((a, b) => a.period.localeCompare(b.period))
    const byPeriod = new Map<string, number | null>()
    for (const row of rows) byPeriod.set(row.period, row.index_value)
    out.set(meta.series_id, {
      meta,
      periods: rows.map((r) => r.period),
      values: rows.map((r) => r.index_value),
      byPeriod,
    })
  }
  return out
}

/** Shifts a YYYY-MM period by a whole number of months. Calendar based, never row based. */
export function shiftPeriod(period: string, months: number): string {
  const [yearRaw, monthRaw] = period.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const zeroBased = year * 12 + (month - 1) + months
  const newYear = Math.floor(zeroBased / 12)
  const newMonth = (zeroBased % 12) + 1
  return String(newYear).padStart(4, '0') + '-' + String(newMonth).padStart(2, '0')
}

export function periodLabel(period: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const [year, month] = period.split('-')
  const name = names[Number(month) - 1] ?? month
  return name + ' ' + year
}

export function shortPeriodLabel(period: string): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, month] = period.split('-')
  return (names[Number(month) - 1] ?? month) + " '" + year.slice(2)
}

export interface CpiChange {
  value: number | null
  unavailableReason: string | null
  currentPeriod: string
  comparisonPeriod: string
  currentIndex: number | null
  comparisonIndex: number | null
}

/** YoY(t) = (index(t) / index(same calendar month one year earlier) - 1) * 100 */
export function yearOverYear(series: SeriesView, period: string): CpiChange {
  const prior = shiftPeriod(period, -12)
  return periodChange(series, prior, period)
}

/** period_change(a,b) = (index(b) / index(a) - 1) * 100 */
export function periodChange(series: SeriesView, from: string, to: string): CpiChange {
  const currentIndex = series.byPeriod.has(to) ? series.byPeriod.get(to)! : null
  const comparisonIndex = series.byPeriod.has(from) ? series.byPeriod.get(from)! : null
  const base = { currentPeriod: to, comparisonPeriod: from, currentIndex, comparisonIndex }
  if (comparisonIndex === null || currentIndex === null) {
    const which = comparisonIndex === null && currentIndex === null
      ? 'Both months are missing in the source.'
      : comparisonIndex === null
        ? periodLabel(from) + ' is missing in the source.'
        : periodLabel(to) + ' is missing in the source.'
    return { ...base, value: null, unavailableReason: which + ' Missing months are not filled in or interpolated.' }
  }
  if (comparisonIndex === 0) {
    return { ...base, value: null, unavailableReason: 'The comparison month index is zero, so a percent change is undefined.' }
  }
  return { ...base, value: (currentIndex / comparisonIndex - 1) * 100, unavailableReason: null }
}

/** rebased_index(t) = index(t) / index(base_month) * 100 */
export function rebase(series: SeriesView, basePeriod: string): Array<{ period: string; value: number | null }> {
  const baseValue = series.byPeriod.get(basePeriod) ?? null
  return series.periods.map((period) => {
    const value = series.byPeriod.get(period) ?? null
    if (baseValue === null || baseValue === 0 || value === null) return { period, value: null }
    return { period, value: (value / baseValue) * 100 }
  })
}

/** The latest month that actually carries a value, never the computer's current month. */
export function latestObservedPeriod(series: SeriesView): string | null {
  for (let i = series.periods.length - 1; i >= 0; i -= 1) {
    if (series.values[i] !== null) return series.periods[i]
  }
  return null
}

export interface CoverageStats {
  seriesCount: number
  periodsPerSeries: number
  totalSlots: number
  numericValues: number
  missingValues: number
  missingPeriods: string[]
}

export function coverageStats(snapshot: CpiSnapshot): CoverageStats {
  const seriesIds = snapshot.series.map((s) => s.series_id)
  const perSeries = new Set(snapshot.observations.map((o) => o.period))
  const numericValues = snapshot.observations.filter((o) => o.index_value !== null).length
  const missing = snapshot.observations.filter((o) => o.index_value === null)
  return {
    seriesCount: seriesIds.length,
    periodsPerSeries: perSeries.size,
    totalSlots: snapshot.observations.length,
    numericValues,
    missingValues: missing.length,
    missingPeriods: [...new Set(missing.map((o) => o.period))].sort(),
  }
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return 'Not available'
  const rounded = value.toFixed(decimals)
  return (value > 0 ? '+' : '') + rounded + '%'
}
