import { percent, roundHalfUp } from './money'
import { eligiblePrice, type EligibilityContext, type EligiblePrice } from './pricing'
import type { BasketLine, PriceObservation, Product, Store, TripSettings } from './types'
import { packagesRequired } from './units'

export type LineStatus = 'priced' | 'unpriced' | 'blocked'

export interface LineResult {
  lineId: string
  storeId: string
  chosenProductId: string | null
  status: LineStatus
  packages: number | null
  unitPriceCents: number | null
  lineTotalCents: number | null
  overbuyAmount: number | null
  overbuyUnit: string | null
  appliedSale: boolean
  stale: boolean
  observedAt: string | null
  reasons: string[]
}

export interface Plan {
  planId: string
  usedStoreIds: string[]
  candidateStoreIds: string[]
  lines: LineResult[]
  merchandiseCents: number
  feesCents: number
  shoppingCostCents: number
  knownItemSubtotalCents: number
  complete: boolean
  missingLineIds: string[]
  stops: number
}

export interface TripCost {
  fuelCents: number
  extraCashTripCostCents: number
  timeValueCents: number | null
  errors: Record<string, string>
  valid: boolean
}

export type DecisionKind =
  | 'cannot_compare'
  | 'no_complete_baseline'
  | 'stay_at_one_store'
  | 'extra_stop_meets_threshold'

export interface Decision {
  kind: DecisionKind
  headline: string
  detail: string
  baselinePlanId: string | null
  baselineStoreId: string | null
  baselineCostCents: number | null
  candidatePlanId: string | null
  candidateStoreIds: string[]
  candidateCostCents: number | null
  grossSavingsCents: number | null
  savingsPercent: number | null
  tripCost: TripCost
  netCashSavingsCents: number | null
  netAfterTimeValueCents: number | null
  decisionBasisCents: number | null
  thresholdCents: number
  extraMinutes: number
  countsTimeValue: boolean
}

export interface EngineInput {
  lines: BasketLine[]
  products: Record<string, Product>
  stores: Store[]
  observations: PriceObservation[]
  eligibility: EligibilityContext
  selectedStoreIds: string[]
  trip: TripSettings
  /** Optional hard filter from the preferences engine. Returning allowed:false blocks the product. */
  productAllowed?: (productId: string) => { allowed: boolean; reason: string } | null
}

export interface ComparisonResult {
  plans: Plan[]
  oneStorePlans: Plan[]
  splitPlans: Plan[]
  baseline: Plan | null
  bestSplit: Plan | null
  recommendedPlan: Plan | null
  decision: Decision
  lineMatrix: LineMatrixRow[]
  conflicts: string[]
}

export interface LineMatrixRow {
  lineId: string
  productId: string
  productName: string
  quantityPackages: number
  byStore: Record<string, LineResult>
  cheapestStoreIds: string[]
}

/** Validates the shopper's trip inputs. Bad input becomes a visible validation state, not a number. */
export function validateTrip(trip: TripSettings): Record<string, string> {
  const errors: Record<string, string> = {}
  const nonNegative: Array<[keyof TripSettings, string]> = [
    ['extraMiles', 'Extra miles'],
    ['fuelPriceCentsPerGallon', 'Fuel price'],
    ['incrementalTollsCents', 'Tolls'],
    ['incrementalParkingCents', 'Parking'],
    ['otherIncrementalCashCents', 'Other trip cost'],
    ['extraMinutes', 'Extra minutes'],
    ['timeValueCentsPerHour', 'Value of your time'],
    ['minimumNetSavingsCents', 'Minimum net savings'],
  ]
  for (const [key, label] of nonNegative) {
    const value = trip[key] as number
    if (!Number.isFinite(value)) errors[key as string] = label + ' must be a number.'
    else if (value < 0) errors[key as string] = label + ' cannot be negative.'
  }
  if (!Number.isFinite(trip.mpg) || trip.mpg <= 0) errors.mpg = 'Miles per gallon must be greater than zero.'
  return errors
}

export function computeTripCost(trip: TripSettings): TripCost {
  const errors = validateTrip(trip)
  if (Object.keys(errors).length > 0) {
    return { fuelCents: 0, extraCashTripCostCents: 0, timeValueCents: null, errors, valid: false }
  }
  const fuelCents = roundHalfUp((trip.extraMiles / trip.mpg) * trip.fuelPriceCentsPerGallon)
  const extraCashTripCostCents =
    fuelCents + trip.incrementalTollsCents + trip.incrementalParkingCents + trip.otherIncrementalCashCents
  const timeValueCents = trip.countTimeValue
    ? roundHalfUp((trip.extraMinutes / 60) * trip.timeValueCentsPerHour)
    : null
  return { fuelCents, extraCashTripCostCents, timeValueCents, errors, valid: true }
}

function allowedProductIds(line: BasketLine): string[] {
  if (line.exactProductLock) return [line.productId]
  const seen = new Set<string>([line.productId, ...line.acceptableAlternativeIds])
  return [...seen]
}

function priceLineAtStore(
  line: BasketLine,
  storeId: string,
  input: EngineInput,
): LineResult {
  const reasons: string[] = []
  const candidates = allowedProductIds(line)
  let best: LineResult | null = null

  for (const productId of candidates) {
    const product = input.products[productId]
    if (!product) {
      reasons.push('Product ' + productId + ' is not in the loaded catalog.')
      continue
    }
    const gate = input.productAllowed ? input.productAllowed(productId) : null
    if (gate && !gate.allowed && !line.dietExceptionAccepted) {
      reasons.push(product.name + ': ' + gate.reason)
      continue
    }

    let packages = line.quantityPackages
    let overbuyAmount: number | null = null
    let overbuyUnit: string | null = null
    if (line.requiredAmount !== null && line.requiredUnit !== null) {
      const need = packagesRequired(line.requiredAmount, line.requiredUnit, product.packageAmount, product.packageUnit)
      if (need.error || need.packages === null) {
        reasons.push(product.name + ': ' + (need.error ?? 'Cannot compute package count.'))
        continue
      }
      packages = need.packages
      overbuyAmount = need.overbuyAmount
      overbuyUnit = need.overbuyUnit
    }
    if (!Number.isFinite(packages) || packages <= 0 || !Number.isInteger(packages)) {
      reasons.push('Quantity must be a whole number greater than zero.')
      continue
    }

    const price: EligiblePrice = eligiblePrice(input.observations, productId, storeId, {
      ...input.eligibility,
      unitsIntended: packages,
    })
    if (price.status !== 'priced' || price.unitPriceCents === null) {
      reasons.push(product.name + ': ' + price.reasons.join(' '))
      continue
    }
    const lineTotalCents = price.unitPriceCents * packages
    const candidate: LineResult = {
      lineId: line.lineId,
      storeId,
      chosenProductId: productId,
      status: 'priced',
      packages,
      unitPriceCents: price.unitPriceCents,
      lineTotalCents,
      overbuyAmount,
      overbuyUnit,
      appliedSale: price.appliedSale,
      stale: price.stale,
      observedAt: price.observedAt,
      reasons: price.reasons,
    }
    if (best === null || candidate.lineTotalCents! < best.lineTotalCents! ||
      (candidate.lineTotalCents === best.lineTotalCents && candidate.chosenProductId! < best.chosenProductId!)) {
      best = candidate
    }
  }

  if (best) return best

  const lockedGate = input.productAllowed ? input.productAllowed(line.productId) : null
  const blocked = Boolean(lockedGate && !lockedGate.allowed && !line.dietExceptionAccepted)
  return {
    lineId: line.lineId,
    storeId,
    chosenProductId: null,
    status: blocked ? 'blocked' : 'unpriced',
    packages: null,
    unitPriceCents: null,
    lineTotalCents: null,
    overbuyAmount: null,
    overbuyUnit: null,
    appliedSale: false,
    stale: false,
    observedAt: null,
    reasons: reasons.length ? reasons : ['No eligible option at this store.'],
  }
}

function assemblePlan(planId: string, candidateStoreIds: string[], lines: LineResult[], stores: Store[]): Plan {
  const usedStoreIds = [...new Set(lines.filter((l) => l.status === 'priced').map((l) => l.storeId))].sort()
  const knownItemSubtotalCents = lines.reduce((sum, l) => sum + (l.lineTotalCents ?? 0), 0)
  const missingLineIds = lines.filter((l) => l.status !== 'priced').map((l) => l.lineId)
  const complete = missingLineIds.length === 0
  // A fee is charged once for each store actually used, never per line and never for an unused store.
  const feesCents = usedStoreIds.reduce((sum, id) => {
    const store = stores.find((s) => s.storeId === id)
    return sum + (store ? store.perTripFeeCents : 0)
  }, 0)
  const merchandiseCents = complete ? knownItemSubtotalCents : 0
  return {
    planId,
    usedStoreIds,
    candidateStoreIds,
    lines,
    merchandiseCents,
    feesCents: complete ? feesCents : 0,
    shoppingCostCents: complete ? knownItemSubtotalCents + feesCents : 0,
    knownItemSubtotalCents,
    complete,
    missingLineIds,
    stops: usedStoreIds.length,
  }
}

export function buildOneStorePlan(storeId: string, input: EngineInput): Plan {
  const lines = input.lines.map((line) => priceLineAtStore(line, storeId, input))
  return assemblePlan('single:' + storeId, [storeId], lines, input.stores)
}

export function buildSplitPlan(storeA: string, storeB: string, input: EngineInput): Plan {
  const lines = input.lines.map((line) => {
    const a = priceLineAtStore(line, storeA, input)
    const b = priceLineAtStore(line, storeB, input)
    if (a.status === 'priced' && b.status === 'priced') {
      if (b.lineTotalCents! < a.lineTotalCents!) return b
      return a // deterministic tie-break: the first selected store keeps the line
    }
    if (a.status === 'priced') return a
    if (b.status === 'priced') return b
    return a
  })
  return assemblePlan('split:' + storeA + '+' + storeB, [storeA, storeB], lines, input.stores)
}

function comparePlanOrder(a: Plan, b: Plan): number {
  if (a.shoppingCostCents !== b.shoppingCostCents) return a.shoppingCostCents - b.shoppingCostCents
  if (a.stops !== b.stops) return a.stops - b.stops // equal cost prefers fewer stops
  return a.planId.localeCompare(b.planId)
}

export function compareBasket(input: EngineInput): ComparisonResult {
  const storeIds = [...input.selectedStoreIds]
  const conflicts: string[] = []

  for (const line of input.lines) {
    if (!input.productAllowed || line.dietExceptionAccepted) continue
    const gate = input.productAllowed(line.productId)
    if (gate && !gate.allowed && line.exactProductLock) {
      const name = input.products[line.productId]?.name ?? line.productId
      conflicts.push(
        name + ' is locked as an exact product but it also fails one of your hard rules: ' + gate.reason +
          ' Resolve this yourself. The optimizer will not ignore either instruction.',
      )
    }
  }

  const oneStorePlans = storeIds.map((id) => buildOneStorePlan(id, input))
  const splitPlans: Plan[] = []
  for (let i = 0; i < storeIds.length; i += 1) {
    for (let j = i + 1; j < storeIds.length; j += 1) {
      const plan = buildSplitPlan(storeIds[i], storeIds[j], input)
      if (plan.usedStoreIds.length >= 2) splitPlans.push(plan)
    }
  }

  const plans = [...oneStorePlans, ...splitPlans]
  const completeOneStore = oneStorePlans.filter((p) => p.complete).sort(comparePlanOrder)
  const completeSplits = splitPlans.filter((p) => p.complete).sort(comparePlanOrder)
  const baseline = completeOneStore[0] ?? null
  const bestSplit = completeSplits[0] ?? null

  const tripCost = computeTripCost(input.trip)
  const threshold = Number.isFinite(input.trip.minimumNetSavingsCents) ? input.trip.minimumNetSavingsCents : 0

  const lineMatrix: LineMatrixRow[] = input.lines.map((line) => {
    const byStore: Record<string, LineResult> = {}
    for (const storeId of storeIds) {
      const existing = oneStorePlans.find((p) => p.candidateStoreIds[0] === storeId)
      const fromPlan = existing?.lines.find((l) => l.lineId === line.lineId)
      byStore[storeId] = fromPlan ?? priceLineAtStore(line, storeId, input)
    }
    const priced = Object.values(byStore).filter((r) => r.status === 'priced')
    const min = priced.length ? Math.min(...priced.map((r) => r.lineTotalCents!)) : null
    return {
      lineId: line.lineId,
      productId: line.productId,
      productName: input.products[line.productId]?.name ?? line.productId,
      quantityPackages: line.quantityPackages,
      byStore,
      cheapestStoreIds: min === null ? [] : priced.filter((r) => r.lineTotalCents === min).map((r) => r.storeId),
    }
  })

  const emptyDecision = (kind: DecisionKind, headline: string, detail: string): Decision => ({
    kind,
    headline,
    detail,
    baselinePlanId: baseline?.planId ?? null,
    baselineStoreId: baseline?.usedStoreIds[0] ?? null,
    baselineCostCents: baseline?.shoppingCostCents ?? null,
    candidatePlanId: null,
    candidateStoreIds: [],
    candidateCostCents: null,
    grossSavingsCents: null,
    savingsPercent: null,
    tripCost,
    netCashSavingsCents: null,
    netAfterTimeValueCents: null,
    decisionBasisCents: null,
    thresholdCents: threshold,
    extraMinutes: input.trip.extraMinutes,
    countsTimeValue: input.trip.countTimeValue,
  })

  if (input.lines.length === 0) {
    return {
      plans, oneStorePlans, splitPlans, baseline, bestSplit, recommendedPlan: null, lineMatrix, conflicts,
      decision: emptyDecision('cannot_compare', 'Add at least one item.', 'A basket is needed before anything can be compared.'),
    }
  }

  if (!baseline && !bestSplit) {
    const missing = new Set<string>()
    for (const plan of plans) plan.missingLineIds.forEach((id) => missing.add(id))
    return {
      plans, oneStorePlans, splitPlans, baseline, bestSplit, recommendedPlan: null, lineMatrix, conflicts,
      decision: emptyDecision(
        'cannot_compare',
        'We cannot compare complete baskets yet.',
        'Missing prices for ' + missing.size + ' item' + (missing.size === 1 ? '' : 's') +
          '. An incomplete basket is never treated as the cheapest basket, and a missing price is never counted as zero.',
      ),
    }
  }

  if (!baseline && bestSplit) {
    return {
      plans, oneStorePlans, splitPlans, baseline, bestSplit, recommendedPlan: bestSplit, lineMatrix, conflicts,
      decision: {
        ...emptyDecision(
          'no_complete_baseline',
          'Only a two store plan can cover this basket.',
          'No single store carries every item, so there is no complete one store baseline to measure savings against. The split plan below is feasible, but no savings figure is shown because there is nothing complete to compare it to.',
        ),
        candidatePlanId: bestSplit.planId,
        candidateStoreIds: bestSplit.usedStoreIds,
        candidateCostCents: bestSplit.shoppingCostCents,
      },
    }
  }

  const base = baseline as Plan
  if (!bestSplit) {
    return {
      plans, oneStorePlans, splitPlans, baseline: base, bestSplit: null, recommendedPlan: base, lineMatrix, conflicts,
      decision: {
        ...emptyDecision('stay_at_one_store', 'Stay at one store.', 'No complete two store plan beats the cheapest complete one store plan, so a second stop has nothing to add.'),
        candidatePlanId: base.planId,
        candidateStoreIds: base.usedStoreIds,
        candidateCostCents: base.shoppingCostCents,
        grossSavingsCents: 0,
        netCashSavingsCents: tripCost.valid ? 0 - tripCost.extraCashTripCostCents : null,
      },
    }
  }

  const grossSavingsCents = base.shoppingCostCents - bestSplit.shoppingCostCents
  if (!tripCost.valid) {
    return {
      plans, oneStorePlans, splitPlans, baseline: base, bestSplit, recommendedPlan: base, lineMatrix, conflicts,
      decision: {
        ...emptyDecision('cannot_compare', 'Check your trip settings.', 'Net savings cannot be calculated until the highlighted trip inputs are valid.'),
        candidatePlanId: bestSplit.planId,
        candidateStoreIds: bestSplit.usedStoreIds,
        candidateCostCents: bestSplit.shoppingCostCents,
        grossSavingsCents,
        savingsPercent: percent(grossSavingsCents, base.shoppingCostCents),
      },
    }
  }

  const netCashSavingsCents = grossSavingsCents - tripCost.extraCashTripCostCents
  const netAfterTimeValueCents =
    tripCost.timeValueCents === null ? null : netCashSavingsCents - tripCost.timeValueCents
  const decisionBasisCents = input.trip.countTimeValue && netAfterTimeValueCents !== null
    ? netAfterTimeValueCents
    : netCashSavingsCents
  // Zero benefit prefers fewer stops. Threshold equality with a positive benefit qualifies.
  const qualifies = decisionBasisCents > 0 && decisionBasisCents >= threshold
  const recommendedPlan = qualifies ? bestSplit : base

  const decision: Decision = {
    kind: qualifies ? 'extra_stop_meets_threshold' : 'stay_at_one_store',
    headline: qualifies ? 'The extra stop meets your threshold.' : 'Stay at one store.',
    detail: qualifies
      ? 'Splitting the basket clears the minimum net savings you set, after the trip cost you entered.'
      : 'After your estimated trip cost and your minimum, the second stop does not pay for itself.',
    baselinePlanId: base.planId,
    baselineStoreId: base.usedStoreIds[0] ?? null,
    baselineCostCents: base.shoppingCostCents,
    candidatePlanId: bestSplit.planId,
    candidateStoreIds: bestSplit.usedStoreIds,
    candidateCostCents: bestSplit.shoppingCostCents,
    grossSavingsCents,
    savingsPercent: percent(grossSavingsCents, base.shoppingCostCents),
    tripCost,
    netCashSavingsCents,
    netAfterTimeValueCents,
    decisionBasisCents,
    thresholdCents: threshold,
    extraMinutes: input.trip.extraMinutes,
    countsTimeValue: input.trip.countTimeValue,
  }

  return { plans, oneStorePlans, splitPlans, baseline: base, bestSplit, recommendedPlan, lineMatrix, conflicts, decision }
}
