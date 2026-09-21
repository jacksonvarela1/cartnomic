import { z } from 'zod'
import type { PriceObservation, Product, Store, StockStatus } from './types'

export const MAX_IMPORT_BYTES = 1_000_000
export const MAX_IMPORT_ROWS = 2_000

/** RFC 4180 style parser: quoted commas, escaped quotes and embedded line breaks all survive. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < clean.length) {
    const char = clean[i]
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += char; i += 1; continue
    }
    if (char === '"') { inQuotes = true; i += 1; continue }
    if (char === ',') { row.push(field); field = ''; i += 1; continue }
    if (char === '\r') { i += 1; continue }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue }
    field += char; i += 1
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

export function toRecords(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => { record[key] = (r[index] ?? '').trim() })
    return record
  })
}

const optionalCents = z
  .string()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), { message: 'Price must be a whole number of cents that is zero or greater, or blank for unknown' })

const isoDate = z.string().refine((v) => v !== '' && !Number.isNaN(new Date(v).getTime()), {
  message: 'Use an ISO timestamp such as 2026-09-20T17:30:00-05:00',
})

const safeText = z.string().max(400)

export const observationRowSchema = z.object({
  observation_id: z.string().min(1, 'observation_id is required'),
  product_id: z.string().min(1, 'product_id is required'),
  store_id: z.string().min(1, 'store_id is required'),
  observed_at: isoDate,
  source_url: safeText.optional().default(''),
  source_type: safeText.optional().default(''),
  channel: safeText.optional().default('in_store'),
  currency: z.string().optional().default('USD'),
  regular_price_cents: optionalCents,
  sale_price_cents: optionalCents.optional(),
  sale_starts_at: z.string().optional().default(''),
  sale_ends_at: z.string().optional().default(''),
  member_required: z.string().optional().default(''),
  coupon_required: z.string().optional().default(''),
  minimum_units: z.string().optional().default(''),
  stock_status: z.string().optional().default('unknown'),
  verification_status: z.string().optional().default('unreviewed'),
  reviewer_id: z.string().optional().default(''),
  notes: safeText.optional().default(''),
})

export const storeRowSchema = z.object({
  store_id: z.string().min(1, 'store_id is required'),
  retailer_name: z.string().min(1, 'retailer_name is required'),
  location_name: z.string().optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  postal_code: z.string().optional().default(''),
  source_url: z.string().optional().default(''),
  verified_at: z.string().optional().default(''),
  notes: safeText.optional().default(''),
})

export const productRowSchema = z.object({
  product_id: z.string().min(1, 'product_id is required'),
  name: z.string().min(1, 'name is required'),
  brand: z.string().optional().default(''),
  gtin_upc: z.string().optional().default(''),
  package_amount: z.string().refine((v) => v !== '' && Number(v) > 0, { message: 'package_amount must be greater than zero' }),
  package_unit: z.enum(['count', 'oz_mass', 'lb_mass', 'g', 'kg', 'US_fl_oz', 'mL', 'L']),
  package_count: z.string().optional().default('1'),
  category: z.string().optional().default(''),
  nutrition_record_id: z.string().optional().default(''),
  label_source_url: z.string().optional().default(''),
  label_verified_at: z.string().optional().default(''),
  notes: safeText.optional().default(''),
})

function truthy(value: string): boolean {
  return ['true', 'yes', '1', 'y'].includes(value.trim().toLowerCase())
}

function normalizeStock(value: string): StockStatus {
  const v = value.trim().toLowerCase()
  if (v === 'available' || v === 'available_at_observation' || v === 'in_stock') return 'available_at_observation'
  if (v === 'unavailable' || v === 'out_of_stock') return 'unavailable'
  return 'unknown'
}

export interface RowError {
  rowNumber: number
  field: string
  message: string
}

export interface ImportPreview<T> {
  kind: 'observations' | 'stores' | 'products'
  accepted: T[]
  duplicatesInFile: number
  duplicatesAgainstExisting: number
  errors: RowError[]
  totalRows: number
  fatalError: string | null
}

export function previewObservations(
  text: string,
  existing: PriceObservation[],
): ImportPreview<PriceObservation> {
  const empty: ImportPreview<PriceObservation> = {
    kind: 'observations', accepted: [], duplicatesInFile: 0, duplicatesAgainstExisting: 0, errors: [], totalRows: 0, fatalError: null,
  }
  if (text.length > MAX_IMPORT_BYTES) {
    return { ...empty, fatalError: 'File is larger than the ' + Math.round(MAX_IMPORT_BYTES / 1000) + ' KB import limit.' }
  }
  const records = toRecords(parseCsv(text))
  if (records.length === 0) return { ...empty, fatalError: 'No data rows were found under the header.' }
  if (records.length > MAX_IMPORT_ROWS) {
    return { ...empty, fatalError: 'File has ' + records.length + ' rows, over the ' + MAX_IMPORT_ROWS + ' row limit.' }
  }

  const errors: RowError[] = []
  const accepted: PriceObservation[] = []
  const seenInFile = new Set<string>()
  const existingIds = new Set(existing.map((o) => o.observationId))
  let duplicatesInFile = 0
  let duplicatesAgainstExisting = 0

  records.forEach((record, index) => {
    const rowNumber = index + 2
    const parsed = observationRowSchema.safeParse(record)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ rowNumber, field: String(issue.path[0] ?? 'row'), message: issue.message })
      }
      return
    }
    const row = parsed.data
    if (seenInFile.has(row.observation_id)) { duplicatesInFile += 1; return }
    seenInFile.add(row.observation_id)
    if (existingIds.has(row.observation_id)) { duplicatesAgainstExisting += 1; return }

    accepted.push({
      observationId: row.observation_id,
      productId: row.product_id,
      storeId: row.store_id,
      currency: row.currency || 'USD',
      priceCents: row.regular_price_cents,
      salePriceCents: row.sale_price_cents ?? null,
      saleStartsAt: row.sale_starts_at || null,
      saleEndsAt: row.sale_ends_at || null,
      memberRequired: truthy(row.member_required),
      couponRequired: truthy(row.coupon_required),
      minimumUnits: row.minimum_units === '' ? null : Number(row.minimum_units),
      observedAt: row.observed_at,
      channel: row.channel || 'in_store',
      stockStatus: normalizeStock(row.stock_status),
      dataMode: 'verified',
      provenance: 'user_observation',
      sourceKind: row.source_type || 'user_entry',
      sourceUrl: row.source_url || null,
      // An uploaded file is the shopper's own unreviewed record until a person reviews it.
      reviewStatus: 'unreviewed',
      notes: row.notes || null,
    })
  })

  return { kind: 'observations', accepted, duplicatesInFile, duplicatesAgainstExisting, errors, totalRows: records.length, fatalError: null }
}

export function previewStores(text: string, existing: Store[]): ImportPreview<Store> {
  const empty: ImportPreview<Store> = {
    kind: 'stores', accepted: [], duplicatesInFile: 0, duplicatesAgainstExisting: 0, errors: [], totalRows: 0, fatalError: null,
  }
  if (text.length > MAX_IMPORT_BYTES) return { ...empty, fatalError: 'File is larger than the import limit.' }
  const records = toRecords(parseCsv(text))
  if (records.length === 0) return { ...empty, fatalError: 'No data rows were found under the header.' }

  const errors: RowError[] = []
  const accepted: Store[] = []
  const seen = new Set<string>()
  const existingIds = new Set(existing.map((s) => s.storeId))
  let duplicatesInFile = 0
  let duplicatesAgainstExisting = 0

  records.forEach((record, index) => {
    const rowNumber = index + 2
    const parsed = storeRowSchema.safeParse(record)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push({ rowNumber, field: String(issue.path[0] ?? 'row'), message: issue.message })
      return
    }
    const row = parsed.data
    if (seen.has(row.store_id)) { duplicatesInFile += 1; return }
    seen.add(row.store_id)
    if (existingIds.has(row.store_id)) { duplicatesAgainstExisting += 1; return }
    accepted.push({
      storeId: row.store_id,
      name: row.location_name ? row.retailer_name + ' ' + row.location_name : row.retailer_name,
      retailer: row.retailer_name,
      address: [row.address, row.city, row.state, row.postal_code].filter(Boolean).join(', ') || null,
      dataMode: 'verified',
      provenance: 'user_observation',
      perTripFeeCents: 0,
      verifiedAt: row.verified_at || null,
    })
  })

  return { kind: 'stores', accepted, duplicatesInFile, duplicatesAgainstExisting, errors, totalRows: records.length, fatalError: null }
}

export function previewProducts(text: string, existing: Product[]): ImportPreview<Product> {
  const empty: ImportPreview<Product> = {
    kind: 'products', accepted: [], duplicatesInFile: 0, duplicatesAgainstExisting: 0, errors: [], totalRows: 0, fatalError: null,
  }
  if (text.length > MAX_IMPORT_BYTES) return { ...empty, fatalError: 'File is larger than the import limit.' }
  const records = toRecords(parseCsv(text))
  if (records.length === 0) return { ...empty, fatalError: 'No data rows were found under the header.' }

  const errors: RowError[] = []
  const accepted: Product[] = []
  const seen = new Set<string>()
  const existingIds = new Set(existing.map((p) => p.productId))
  let duplicatesInFile = 0
  let duplicatesAgainstExisting = 0

  records.forEach((record, index) => {
    const rowNumber = index + 2
    const parsed = productRowSchema.safeParse(record)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push({ rowNumber, field: String(issue.path[0] ?? 'row'), message: issue.message })
      return
    }
    const row = parsed.data
    if (seen.has(row.product_id)) { duplicatesInFile += 1; return }
    seen.add(row.product_id)
    if (existingIds.has(row.product_id)) { duplicatesAgainstExisting += 1; return }
    accepted.push({
      productId: row.product_id,
      name: row.name,
      brand: row.brand || null,
      gtinUpc: row.gtin_upc || null, // kept as a string so leading zeros survive
      packageAmount: Number(row.package_amount),
      packageUnit: row.package_unit,
      packageCount: Number(row.package_count || '1'),
      category: row.category || null,
      nutritionRecordId: row.nutrition_record_id || null,
      nutritionLinkNote: null,
      dataMode: 'verified',
      provenance: 'user_observation',
    })
  })

  return { kind: 'products', accepted, duplicatesInFile, duplicatesAgainstExisting, errors, totalRows: records.length, fatalError: null }
}

/** Spreadsheet formula injection is neutralized on export and source text is never executed. */
export function neutralizeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const needsGuard = /^[=+\-@\t\r]/.test(raw)
  const guarded = needsGuard ? "'" + raw : raw
  if (/[",\n\r]/.test(guarded)) return '"' + guarded.replace(/"/g, '""') + '"'
  return guarded
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return ''
  const header = columns ?? Object.keys(rows[0])
  const lines = [header.map(neutralizeCsvValue).join(',')]
  for (const row of rows) lines.push(header.map((key) => neutralizeCsvValue(row[key])).join(','))
  return lines.join('\r\n')
}
