import type { DataMode, PriceObservation } from './types'

export interface EligibilityContext {
  /** Comparison clock. Tests pass an explicit clock so fixtures never expire with the wall clock. */
  clockIso: string
  currency: string
  dataMode: DataMode
  hasMembership: Record<string, boolean>
  couponOptIn: boolean
  /** Number of packages the shopper intends to buy on this line. */
  unitsIntended: number
  /** Product policy, not a claim about retailer update frequency. */
  stalePriceDays: number
  excludeStalePrices: boolean
}

export const DEFAULT_ELIGIBILITY: Omit<EligibilityContext, 'clockIso' | 'dataMode'> = {
  currency: 'USD',
  hasMembership: {},
  couponOptIn: false,
  unitsIntended: 1,
  stalePriceDays: 7,
  excludeStalePrices: false,
}

export type PriceStatus = 'priced' | 'no_price_observed' | 'ineligible' | 'not_observed'

export interface EligiblePrice {
  status: PriceStatus
  unitPriceCents: number | null
  appliedSale: boolean
  observation: PriceObservation | null
  reasons: string[]
  stale: boolean
  observedAt: string | null
}

function msBetween(aIso: string, bIso: string): number {
  return new Date(bIso).getTime() - new Date(aIso).getTime()
}

/**
 * The most recent valid observation at or before the comparison clock.
 * Ties resolve deterministically by observation id so repeated runs agree.
 */
export function selectObservation(
  observations: PriceObservation[],
  productId: string,
  storeId: string,
  ctx: EligibilityContext,
): PriceObservation | null {
  const clock = new Date(ctx.clockIso).getTime()
  const candidates = observations.filter(
    (o) =>
      o.productId === productId &&
      o.storeId === storeId &&
      o.dataMode === ctx.dataMode &&
      o.currency === ctx.currency &&
      new Date(o.observedAt).getTime() <= clock,
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const diff = new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    if (diff !== 0) return diff
    return a.observationId.localeCompare(b.observationId)
  })
  return candidates[0]
}

/** Applies offer eligibility. A sale only counts inside its dates and with its conditions met. */
export function eligiblePrice(
  observations: PriceObservation[],
  productId: string,
  storeId: string,
  ctx: EligibilityContext,
): EligiblePrice {
  const none: EligiblePrice = {
    status: 'not_observed',
    unitPriceCents: null,
    appliedSale: false,
    observation: null,
    reasons: ['No price has been observed for this item at this store.'],
    stale: false,
    observedAt: null,
  }

  const mismatchedCurrency = observations.some(
    (o) => o.productId === productId && o.storeId === storeId && o.currency !== ctx.currency,
  )
  const obs = selectObservation(observations, productId, storeId, ctx)
  if (!obs) {
    if (mismatchedCurrency) {
      return { ...none, status: 'ineligible', reasons: ['Observation currency does not match the comparison currency.'] }
    }
    return none
  }

  const reasons: string[] = []
  const ageDays = msBetween(obs.observedAt, ctx.clockIso) / 86_400_000
  const stale = ageDays > ctx.stalePriceDays
  if (stale) {
    reasons.push('Observed ' + Math.floor(ageDays) + ' days ago, past your ' + ctx.stalePriceDays + ' day freshness setting.')
  }
  if (stale && ctx.excludeStalePrices) {
    return { status: 'ineligible', unitPriceCents: null, appliedSale: false, observation: obs, reasons, stale, observedAt: obs.observedAt }
  }

  if (obs.stockStatus === 'unavailable') {
    reasons.push('Recorded as out of stock at the time of the observation.')
    return { status: 'ineligible', unitPriceCents: null, appliedSale: false, observation: obs, reasons, stale, observedAt: obs.observedAt }
  }
  if (obs.stockStatus === 'unknown') {
    reasons.push('Stock was not recorded. This is a priced estimate, not an in stock check.')
  }

  if (obs.priceCents === null) {
    reasons.push('No price recorded. A missing price is unknown, never zero.')
    return { status: 'no_price_observed', unitPriceCents: null, appliedSale: false, observation: obs, reasons, stale, observedAt: obs.observedAt }
  }

  if (obs.memberRequired && !ctx.hasMembership[obs.storeId]) {
    reasons.push('This price requires a membership you have not marked as held.')
    return { status: 'ineligible', unitPriceCents: null, appliedSale: false, observation: obs, reasons, stale, observedAt: obs.observedAt }
  }
  if (obs.couponRequired && !ctx.couponOptIn) {
    reasons.push('This price requires a coupon you have not opted into.')
    return { status: 'ineligible', unitPriceCents: null, appliedSale: false, observation: obs, reasons, stale, observedAt: obs.observedAt }
  }

  let unitPriceCents = obs.priceCents
  let appliedSale = false
  if (obs.salePriceCents !== null) {
    const clock = new Date(ctx.clockIso).getTime()
    const startsOk = obs.saleStartsAt === null ? false : new Date(obs.saleStartsAt).getTime() <= clock
    const endsOk = obs.saleEndsAt === null ? false : new Date(obs.saleEndsAt).getTime() >= clock
    const quantityOk = obs.minimumUnits === null || ctx.unitsIntended >= obs.minimumUnits
    if (!startsOk) {
      reasons.push('Sale start date is missing or in the future, so the regular price is used.')
    } else if (!endsOk) {
      reasons.push('Sale end date is missing or past, so the regular price is used. A missing end date is not proof a sale is still live.')
    } else if (!quantityOk) {
      reasons.push('Sale needs at least ' + obs.minimumUnits + ' units, so the regular price is used.')
    } else {
      unitPriceCents = obs.salePriceCents
      appliedSale = true
      reasons.push('Sale price applied. Observed sale window includes the comparison date.')
    }
  }

  return { status: 'priced', unitPriceCents, appliedSale, observation: obs, reasons, stale, observedAt: obs.observedAt }
}
