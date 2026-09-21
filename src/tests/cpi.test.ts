import { describe, expect, it } from 'vitest'
import cpiJson from '../data/bls_cpi_monthly.json'
import snapshotJson from '../data/bls_latest_category_snapshot.json'
import {
  buildSeriesViews,
  coverageStats,
  latestObservedPeriod,
  periodChange,
  shiftPeriod,
  yearOverYear,
  type CpiSnapshot,
} from '../domain/cpi'
import { neutralizeCsvValue, parseCsv, previewObservations, toRecords } from '../domain/importer'

const snapshot = cpiJson as unknown as CpiSnapshot
const views = buildSeriesViews(snapshot)
const foodAtHome = views.get('CUUR0000SAF11')!

describe('06.28 and 06.29 coverage of the included snapshot', () => {
  it('has seven series, 32 monthly slots each, 217 values and seven nulls', () => {
    const stats = coverageStats(snapshot)
    expect(stats.seriesCount).toBe(7)
    expect(stats.periodsPerSeries).toBe(32)
    expect(stats.totalSlots).toBe(224)
    expect(stats.numericValues).toBe(217)
    expect(stats.missingValues).toBe(7)
  })

  it('places every missing value in October 2025 and leaves it null', () => {
    const stats = coverageStats(snapshot)
    expect(stats.missingPeriods).toEqual(['2025-10'])
    for (const view of views.values()) {
      expect(view.byPeriod.get('2025-10')).toBeNull()
    }
  })
})

describe('06.30 and 06.31 change math', () => {
  it('shifts by calendar month, not by row offset', () => {
    expect(shiftPeriod('2026-08', -12)).toBe('2025-08')
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12')
    expect(shiftPeriod('2025-11', -12)).toBe('2024-11')
  })

  it('reproduces the published August 2026 food at home change at one decimal', () => {
    const change = yearOverYear(foodAtHome, '2026-08')
    expect(change.currentIndex).toBe(321.5)
    expect(change.comparisonIndex).toBe(314.608)
    expect(Number(change.value!.toFixed(1))).toBe(2.2)
  })

  it('matches the independently published category snapshot at one decimal', () => {
    for (const row of snapshotJson.observations) {
      const view = views.get(row.series_id)!
      const calculated = yearOverYear(view, '2026-08')
      expect(Number(calculated.value!.toFixed(1))).toBe(row.yoy_pct_bls_published)
    }
  })

  it('returns unavailable rather than skipping a missing month', () => {
    const october = yearOverYear(foodAtHome, '2025-10')
    expect(october.value).toBeNull()
    expect(october.unavailableReason).toContain('missing in the source')
    const against = periodChange(foodAtHome, '2025-10', '2026-08')
    expect(against.value).toBeNull()
  })
})

describe('06.32 the wall clock does not create observations', () => {
  it('derives the latest period from the last value present in the data', () => {
    expect(latestObservedPeriod(foodAtHome)).toBe('2026-08')
    expect(foodAtHome.byPeriod.has('2026-09')).toBe(false)
    expect(snapshot.coverage_end).toBe('2026-08')
  })
})

describe('06.37 and 06.38 import and export safety', () => {
  const header =
    'observation_id,product_id,store_id,observed_at,source_url,source_type,channel,currency,regular_price_cents,sale_price_cents,sale_starts_at,sale_ends_at,member_required,coupon_required,minimum_units,stock_status,verification_status,reviewer_id,notes'

  it('parses quoted commas and escaped quotes', () => {
    const csv = header + '\n' + 'o1,P1,S1,2026-09-20T17:30:00-05:00,,receipt,in_store,USD,349,,,,false,false,,available,unreviewed,,"Aisle 4, shelf ""B"""'
    const records = toRecords(parseCsv(csv))
    expect(records).toHaveLength(1)
    expect(records[0].notes).toBe('Aisle 4, shelf "B"')
    const preview = previewObservations(csv, [])
    expect(preview.errors).toHaveLength(0)
    expect(preview.accepted[0].priceCents).toBe(349)
    expect(preview.accepted[0].reviewStatus).toBe('unreviewed')
  })

  it('reports row level errors and keeps a blank price as unknown', () => {
    const csv = header + '\n' +
      'o1,P1,S1,not-a-date,,receipt,in_store,USD,349,,,,false,false,,available,unreviewed,,\n' +
      'o2,P2,S1,2026-09-20T17:30:00-05:00,,receipt,in_store,USD,,,,,false,false,,unknown,unreviewed,,\n' +
      'o3,,S1,2026-09-20T17:30:00-05:00,,receipt,in_store,USD,-5,,,,false,false,,unknown,unreviewed,,'
    const preview = previewObservations(csv, [])
    expect(preview.errors.some((e) => e.field === 'observed_at')).toBe(true)
    expect(preview.errors.some((e) => e.field === 'product_id')).toBe(true)
    expect(preview.accepted).toHaveLength(1)
    expect(preview.accepted[0].priceCents).toBeNull()
  })

  it('does not duplicate an observation that is already stored', () => {
    const csv = header + '\n' + 'o1,P1,S1,2026-09-20T17:30:00-05:00,,receipt,in_store,USD,349,,,,false,false,,available,unreviewed,,'
    const first = previewObservations(csv, [])
    const second = previewObservations(csv, first.accepted)
    expect(second.accepted).toHaveLength(0)
    expect(second.duplicatesAgainstExisting).toBe(1)
  })

  it('neutralizes spreadsheet formulas and keeps script looking text as text', () => {
    expect(neutralizeCsvValue('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(neutralizeCsvValue('+1')).toBe("'+1")
    expect(neutralizeCsvValue('@cmd')).toBe("'@cmd")
    expect(neutralizeCsvValue('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
    expect(neutralizeCsvValue('plain, text')).toBe('"plain, text"')
  })
})
