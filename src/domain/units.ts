import type { PackageUnit } from './types'

export type UnitFamily = 'count' | 'mass' | 'volume'

const FAMILY: Record<PackageUnit, UnitFamily> = {
  count: 'count',
  oz_mass: 'mass',
  lb_mass: 'mass',
  g: 'mass',
  kg: 'mass',
  US_fl_oz: 'volume',
  mL: 'volume',
  L: 'volume',
}

// Mass normalizes to grams, volume to millilitres. Mass ounces and fluid ounces never convert into
// each other: that would need a density this app does not have.
const TO_BASE: Record<PackageUnit, number> = {
  count: 1,
  g: 1,
  kg: 1000,
  oz_mass: 28.349523125,
  lb_mass: 453.59237,
  mL: 1,
  L: 1000,
  US_fl_oz: 29.5735295625,
}

export const UNIT_LABEL: Record<PackageUnit, string> = {
  count: 'count',
  oz_mass: 'oz (weight)',
  lb_mass: 'lb',
  g: 'g',
  kg: 'kg',
  US_fl_oz: 'fl oz',
  mL: 'mL',
  L: 'L',
}

export function unitFamily(unit: PackageUnit): UnitFamily {
  return FAMILY[unit]
}

export function sameFamily(a: PackageUnit, b: PackageUnit): boolean {
  return FAMILY[a] === FAMILY[b]
}

export interface ConversionResult {
  value: number | null
  error: string | null
}

export function convertAmount(amount: number, from: PackageUnit, to: PackageUnit): ConversionResult {
  if (!Number.isFinite(amount)) return { value: null, error: 'Amount is not a number' }
  if (!sameFamily(from, to)) {
    return {
      value: null,
      error: 'Cannot convert ' + UNIT_LABEL[from] + ' to ' + UNIT_LABEL[to] + ' without a known density',
    }
  }
  return { value: (amount * TO_BASE[from]) / TO_BASE[to], error: null }
}

export interface PackageRequirement {
  packages: number | null
  overbuyAmount: number | null
  overbuyUnit: PackageUnit | null
  error: string | null
}

/** Whole packages only: packages = ceil(required / amount per package). Overbuy is reported. */
export function packagesRequired(
  requiredAmount: number,
  requiredUnit: PackageUnit,
  packageAmount: number,
  packageUnit: PackageUnit,
): PackageRequirement {
  const base = { packages: null, overbuyAmount: null, overbuyUnit: null }
  if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) {
    return { ...base, error: 'Required amount must be greater than zero' }
  }
  if (!Number.isFinite(packageAmount) || packageAmount <= 0) {
    return { ...base, error: 'Package amount must be greater than zero' }
  }
  const converted = convertAmount(packageAmount, packageUnit, requiredUnit)
  if (converted.value === null) return { ...base, error: converted.error }
  // The epsilon absorbs float overshoot, but it must never round a real requirement down to zero
  // packages, so any positive requirement buys at least one package.
  const packages = Math.max(1, Math.ceil(requiredAmount / converted.value - 1e-9))
  const overbuy = packages * converted.value - requiredAmount
  return {
    packages,
    overbuyAmount: Math.round(overbuy * 1e6) / 1e6,
    overbuyUnit: requiredUnit,
    error: null,
  }
}

export function unitPriceLabel(cents: number, amount: number, unit: PackageUnit): string {
  if (amount <= 0) return 'Unit price not available'
  const per = cents / amount
  return '$' + (per / 100).toFixed(per < 10 ? 3 : 2) + ' per ' + UNIT_LABEL[unit]
}
