// Core domain types. Provenance is explicit on every record, never inferred from a file path.

export type Provenance =
  | 'public_observation'
  | 'manufacturer_label'
  | 'user_observation'
  | 'estimate'
  | 'synthetic_demo'

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  public_observation: 'Public data',
  manufacturer_label: 'Manufacturer label',
  user_observation: 'Your observation',
  estimate: 'Your estimate',
  synthetic_demo: 'Fictional demo data',
}

// Least verified status wins when inputs are combined.
const PROVENANCE_RANK: Record<Provenance, number> = {
  public_observation: 4,
  manufacturer_label: 3,
  user_observation: 2,
  estimate: 1,
  synthetic_demo: 0,
}

export function leastVerified(values: Provenance[]): Provenance {
  if (values.length === 0) return 'estimate'
  return values.reduce((a, b) => (PROVENANCE_RANK[b] < PROVENANCE_RANK[a] ? b : a))
}

export type DataMode = 'demo' | 'verified'

export type StockStatus = 'available_at_observation' | 'unavailable' | 'unknown'

export type PackageUnit = 'count' | 'oz_mass' | 'lb_mass' | 'g' | 'kg' | 'US_fl_oz' | 'mL' | 'L'

export interface Product {
  productId: string
  name: string
  brand: string | null
  gtinUpc: string | null // string so leading zeros survive
  packageAmount: number
  packageUnit: PackageUnit
  packageCount: number
  category: string | null
  nutritionRecordId: string | null
  nutritionLinkNote: string | null
  dataMode: DataMode
  provenance: Provenance
}

export interface Store {
  storeId: string
  name: string
  retailer: string | null
  address: string | null
  dataMode: DataMode
  provenance: Provenance
  perTripFeeCents: number
  verifiedAt: string | null
}

export interface PriceObservation {
  observationId: string
  productId: string
  storeId: string
  currency: string
  priceCents: number | null
  salePriceCents: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
  memberRequired: boolean
  couponRequired: boolean
  minimumUnits: number | null
  observedAt: string
  channel: string
  stockStatus: StockStatus
  dataMode: DataMode
  provenance: Provenance
  sourceKind: string
  sourceUrl: string | null
  reviewStatus: 'unreviewed' | 'reviewed' | 'synthetic_demo'
  notes: string | null
}

export interface BasketLine {
  lineId: string
  productId: string
  quantityPackages: number
  requiredAmount: number | null
  requiredUnit: PackageUnit | null
  exactProductLock: boolean
  acceptableAlternativeIds: string[]
  dietExceptionAccepted: boolean
}

export interface TripSettings {
  extraMiles: number
  mpg: number
  fuelPriceCentsPerGallon: number
  incrementalTollsCents: number
  incrementalParkingCents: number
  otherIncrementalCashCents: number
  extraMinutes: number
  countTimeValue: boolean
  timeValueCentsPerHour: number
  minimumNetSavingsCents: number
}

export const DEFAULT_TRIP_SETTINGS: TripSettings = {
  extraMiles: 10,
  mpg: 25,
  fuelPriceCentsPerGallon: 350,
  incrementalTollsCents: 0,
  incrementalParkingCents: 0,
  otherIncrementalCashCents: 0,
  extraMinutes: 15,
  countTimeValue: false,
  timeValueCentsPerHour: 0,
  minimumNetSavingsCents: 1000,
}
