import { describe, expect, it } from 'vitest'
import {
  compareBasket,
  computeTripCost,
  validateTrip,
  type EngineInput,
} from '../domain/compare'
import {
  DEMO_COMPARISON_CLOCK,
  demoBasketLines,
  demoExpectedResults,
  demoObservations,
  demoProducts,
  demoStores,
  productMap,
} from '../domain/catalog'
import { DEFAULT_ELIGIBILITY } from '../domain/pricing'
import { DEFAULT_TRIP_SETTINGS, type BasketLine, type PriceObservation, type Product, type Store, type TripSettings } from '../domain/types'
import { convertAmount, packagesRequired } from '../domain/units'
import { parseDollarsToCents, roundHalfUp } from '../domain/money'

const eligibility = {
  ...DEFAULT_ELIGIBILITY,
  clockIso: DEMO_COMPARISON_CLOCK,
  dataMode: 'demo' as const,
}

const fixtureTrip: TripSettings = {
  ...DEFAULT_TRIP_SETTINGS,
  extraMiles: 0,
  otherIncrementalCashCents: 200, // the fixture states a $2.00 synthetic incremental trip cost
  extraMinutes: 15,
  minimumNetSavingsCents: 1000,
}

function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    lines: demoBasketLines,
    products: productMap(demoProducts),
    stores: demoStores,
    observations: demoObservations,
    eligibility,
    selectedStoreIds: ['DEMO_A', 'DEMO_B'],
    trip: fixtureTrip,
    ...overrides,
  }
}

function obs(partial: Partial<PriceObservation> & { observationId: string; productId: string; storeId: string }): PriceObservation {
  return {
    currency: 'USD',
    priceCents: 100,
    salePriceCents: null,
    saleStartsAt: null,
    saleEndsAt: null,
    memberRequired: false,
    couponRequired: false,
    minimumUnits: null,
    observedAt: '2026-09-01T12:00:00-05:00',
    channel: 'in_store',
    stockStatus: 'available_at_observation',
    dataMode: 'demo',
    provenance: 'synthetic_demo',
    sourceKind: 'fixture',
    sourceUrl: null,
    reviewStatus: 'synthetic_demo',
    notes: null,
    ...partial,
  }
}

function product(id: string, partial: Partial<Product> = {}): Product {
  return {
    productId: id,
    name: 'Test ' + id,
    brand: null,
    gtinUpc: null,
    packageAmount: 1,
    packageUnit: 'count',
    packageCount: 1,
    category: null,
    nutritionRecordId: null,
    nutritionLinkNote: null,
    dataMode: 'demo',
    provenance: 'synthetic_demo',
    ...partial,
  }
}

function line(id: string, productId: string, partial: Partial<BasketLine> = {}): BasketLine {
  return {
    lineId: id,
    productId,
    quantityPackages: 1,
    requiredAmount: null,
    requiredUnit: null,
    exactProductLock: true,
    acceptableAlternativeIds: [],
    dietExceptionAccepted: false,
    ...partial,
  }
}

function store(id: string, feeCents = 0): Store {
  return {
    storeId: id, name: id, retailer: null, address: null,
    dataMode: 'demo', provenance: 'synthetic_demo', perTripFeeCents: feeCents, verifiedAt: null,
  }
}

describe('06.1 supplied fixture totals', () => {
  const result = compareBasket(baseInput())

  it('matches every published expectation in the fixture', () => {
    const storeA = result.oneStorePlans.find((p) => p.candidateStoreIds[0] === 'DEMO_A')!
    const storeB = result.oneStorePlans.find((p) => p.candidateStoreIds[0] === 'DEMO_B')!
    expect(storeA.complete).toBe(demoExpectedResults.store_a_complete)
    expect(storeA.shoppingCostCents).toBe(demoExpectedResults.store_a_merchandise_cents)
    expect(storeB.complete).toBe(demoExpectedResults.store_b_complete)
    expect(storeB.knownItemSubtotalCents).toBe(demoExpectedResults.store_b_known_item_subtotal_cents)
    expect(storeB.missingLineIds).toHaveLength(demoExpectedResults.store_b_missing_product_ids.length)
    expect(result.bestSplit!.shoppingCostCents).toBe(demoExpectedResults.split_merchandise_cents)
    expect(result.decision.grossSavingsCents).toBe(demoExpectedResults.gross_savings_vs_store_a_cents)
    expect(result.decision.tripCost.extraCashTripCostCents).toBe(demoExpectedResults.extra_trip_cost_cents)
    expect(result.decision.netCashSavingsCents).toBe(demoExpectedResults.net_cash_savings_cents)
  })

  it('names the cheapest complete one store plan as the baseline', () => {
    expect(result.baseline!.usedStoreIds).toEqual(['DEMO_A'])
  })

  it('recommends staying at one store when the minimum is $10.00', () => {
    expect(result.decision.kind).toBe('stay_at_one_store')
  })

  it('qualifies the split when the minimum is $2.00', () => {
    const relaxed = compareBasket(baseInput({ trip: { ...fixtureTrip, minimumNetSavingsCents: 200 } }))
    expect(relaxed.decision.kind).toBe('extra_stop_meets_threshold')
    expect(relaxed.recommendedPlan!.stops).toBe(2)
  })
})

describe('06.2 a missing price is unknown, never zero', () => {
  it('leaves the incomplete store out of the baseline and labels the subtotal', () => {
    const result = compareBasket(baseInput())
    const storeB = result.oneStorePlans.find((p) => p.candidateStoreIds[0] === 'DEMO_B')!
    expect(storeB.complete).toBe(false)
    expect(storeB.shoppingCostCents).toBe(0) // not a total; the known item subtotal is reported separately
    expect(storeB.knownItemSubtotalCents).toBe(3660)
    expect(result.baseline!.usedStoreIds).toEqual(['DEMO_A'])
  })

  it('treats an explicit zero cent promotional price as a real price', () => {
    const products = { A: product('A') }
    const observations = [obs({ observationId: 'o1', productId: 'A', storeId: 'S1', priceCents: 0 })]
    const result = compareBasket({
      lines: [line('l1', 'A')], products, stores: [store('S1')], observations,
      eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline!.complete).toBe(true)
    expect(result.baseline!.shoppingCostCents).toBe(0)
  })
})

describe('06.3 no complete one store baseline', () => {
  it('shows a feasible split without inventing savings', () => {
    const products = { A: product('A'), B: product('B') }
    const observations = [
      obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 500 }),
      obs({ observationId: 'b2', productId: 'B', storeId: 'S2', priceCents: 400 }),
    ]
    const result = compareBasket({
      lines: [line('l1', 'A'), line('l2', 'B')], products, stores: [store('S1'), store('S2')],
      observations, eligibility, selectedStoreIds: ['S1', 'S2'], trip: fixtureTrip,
    })
    expect(result.baseline).toBeNull()
    expect(result.decision.kind).toBe('no_complete_baseline')
    expect(result.decision.grossSavingsCents).toBeNull()
    expect(result.decision.savingsPercent).toBeNull()
    expect(result.bestSplit!.complete).toBe(true)
  })
})

describe('06.4 and 06.11 one store already wins', () => {
  it('does not invent a second stop when one store is cheapest on everything', () => {
    const products = { A: product('A'), B: product('B') }
    const observations = [
      obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 100 }),
      obs({ observationId: 'a2', productId: 'A', storeId: 'S2', priceCents: 200 }),
      obs({ observationId: 'b1', productId: 'B', storeId: 'S1', priceCents: 100 }),
      obs({ observationId: 'b2', productId: 'B', storeId: 'S2', priceCents: 200 }),
    ]
    const result = compareBasket({
      lines: [line('l1', 'A'), line('l2', 'B')], products, stores: [store('S1'), store('S2')],
      observations, eligibility, selectedStoreIds: ['S1', 'S2'], trip: fixtureTrip,
    })
    expect(result.splitPlans).toHaveLength(0)
    expect(result.decision.kind).toBe('stay_at_one_store')
  })

  it('prefers fewer stops when the two plans cost the same', () => {
    const products = { A: product('A'), B: product('B') }
    const observations = [
      obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 100 }),
      obs({ observationId: 'a2', productId: 'A', storeId: 'S2', priceCents: 100 }),
      obs({ observationId: 'b1', productId: 'B', storeId: 'S1', priceCents: 100 }),
      obs({ observationId: 'b2', productId: 'B', storeId: 'S2', priceCents: 100 }),
    ]
    const result = compareBasket({
      lines: [line('l1', 'A'), line('l2', 'B')], products, stores: [store('S1'), store('S2')],
      observations, eligibility, selectedStoreIds: ['S1', 'S2'],
      trip: { ...fixtureTrip, otherIncrementalCashCents: 0, minimumNetSavingsCents: 0 },
    })
    expect(result.recommendedPlan!.stops).toBe(1)
    expect(result.decision.kind).toBe('stay_at_one_store')
  })
})

describe('06.5 and 06.6 quantities and whole packages', () => {
  it('rejects a negative or fractional quantity instead of pricing it', () => {
    const products = { A: product('A') }
    const observations = [obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 300 })]
    for (const quantity of [-1, 0, 1.5, Number.NaN]) {
      const result = compareBasket({
        lines: [line('l1', 'A', { quantityPackages: quantity })], products, stores: [store('S1')],
        observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
      })
      expect(result.baseline).toBeNull()
    }
  })

  it('recalculates the total when the quantity changes', () => {
    const products = { A: product('A') }
    const observations = [obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 300 })]
    const three = compareBasket({
      lines: [line('l1', 'A', { quantityPackages: 3 })], products, stores: [store('S1')],
      observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(three.baseline!.shoppingCostCents).toBe(900)
  })

  it('buys whole packages: 20 oz from a 16 oz pack costs 600 cents with 12 oz overbuy', () => {
    const need = packagesRequired(20, 'oz_mass', 16, 'oz_mass')
    expect(need.packages).toBe(2)
    expect(need.overbuyAmount).toBe(12)

    const products = { A: product('A', { packageAmount: 16, packageUnit: 'oz_mass' }) }
    const observations = [obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 300 })]
    const result = compareBasket({
      lines: [line('l1', 'A', { requiredAmount: 20, requiredUnit: 'oz_mass' })], products, stores: [store('S1')],
      observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline!.shoppingCostCents).toBe(600)
    expect(result.baseline!.shoppingCostCents).not.toBe(375)
  })
})

describe('06.7 and 06.8 locks and hard rules', () => {
  const products = { LOCKED: product('LOCKED'), CHEAP: product('CHEAP') }
  const observations = [
    obs({ observationId: 'l1', productId: 'LOCKED', storeId: 'S1', priceCents: 500 }),
    obs({ observationId: 'c1', productId: 'CHEAP', storeId: 'S1', priceCents: 100 }),
  ]

  it('an exact product lock refuses an unapproved cheaper alternative', () => {
    const result = compareBasket({
      lines: [line('l1', 'LOCKED', { exactProductLock: true })], products, stores: [store('S1')],
      observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline!.shoppingCostCents).toBe(500)
  })

  it('an explicitly approved alternative may be used', () => {
    const result = compareBasket({
      lines: [line('l1', 'LOCKED', { exactProductLock: false, acceptableAlternativeIds: ['CHEAP'] })],
      products, stores: [store('S1')], observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline!.shoppingCostCents).toBe(100)
  })

  it('a hard rule can make an otherwise cheap plan infeasible and raises a visible conflict', () => {
    const result = compareBasket({
      lines: [line('l1', 'LOCKED', { exactProductLock: true })], products, stores: [store('S1')],
      observations, eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
      productAllowed: (id) => (id === 'LOCKED' ? { allowed: false, reason: 'excluded ingredient' } : { allowed: true, reason: '' }),
    })
    expect(result.baseline).toBeNull()
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toContain('hard rules')
  })
})

describe('06.9 and 06.12 offer eligibility and stock', () => {
  const products = { A: product('A') }
  const clock = '2026-09-02T12:00:00-05:00'

  function priceOf(partial: Partial<PriceObservation>) {
    const result = compareBasket({
      lines: [line('l1', 'A')], products, stores: [store('S1')],
      observations: [obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 500, ...partial })],
      eligibility: { ...eligibility, clockIso: clock }, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    return result.oneStorePlans[0].lines[0]
  }

  it('applies a sale only inside its window', () => {
    expect(priceOf({ salePriceCents: 300, saleStartsAt: '2026-09-01T00:00:00-05:00', saleEndsAt: '2026-09-30T00:00:00-05:00' }).lineTotalCents).toBe(300)
    expect(priceOf({ salePriceCents: 300, saleStartsAt: '2026-10-01T00:00:00-05:00', saleEndsAt: '2026-10-30T00:00:00-05:00' }).lineTotalCents).toBe(500)
    expect(priceOf({ salePriceCents: 300, saleStartsAt: '2026-08-01T00:00:00-05:00', saleEndsAt: '2026-08-15T00:00:00-05:00' }).lineTotalCents).toBe(500)
    expect(priceOf({ salePriceCents: 300, saleStartsAt: '2026-08-01T00:00:00-05:00', saleEndsAt: null }).lineTotalCents).toBe(500)
  })

  it('does not hand a non member a member only price', () => {
    expect(priceOf({ memberRequired: true }).status).toBe('unpriced')
  })

  it('does not apply a coupon price without opt in', () => {
    expect(priceOf({ couponRequired: true }).status).toBe('unpriced')
  })

  it('does not apply a quantity conditional sale below its minimum', () => {
    expect(priceOf({ salePriceCents: 300, saleStartsAt: '2026-09-01T00:00:00-05:00', saleEndsAt: '2026-09-30T00:00:00-05:00', minimumUnits: 3 }).lineTotalCents).toBe(500)
  })

  it('never uses an observation recorded after the comparison clock', () => {
    const result = compareBasket({
      lines: [line('l1', 'A')], products, stores: [store('S1')],
      observations: [
        obs({ observationId: 'past', productId: 'A', storeId: 'S1', priceCents: 500, observedAt: '2026-09-01T12:00:00-05:00' }),
        obs({ observationId: 'future', productId: 'A', storeId: 'S1', priceCents: 100, observedAt: '2026-12-01T12:00:00-05:00' }),
      ],
      eligibility: { ...eligibility, clockIso: clock }, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline!.shoppingCostCents).toBe(500)
  })

  it('separates recorded out of stock from unrecorded stock', () => {
    expect(priceOf({ stockStatus: 'unavailable' }).status).toBe('unpriced')
    const unknown = priceOf({ stockStatus: 'unknown' })
    expect(unknown.status).toBe('priced')
    expect(unknown.reasons.join(' ')).toContain('not an in stock check')
  })
})

describe('06.10 whole store fees', () => {
  it('charges a fee once per used store and never for an unused store', () => {
    const products = { A: product('A'), B: product('B') }
    const observations = [
      obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 1000 }),
      obs({ observationId: 'a2', productId: 'A', storeId: 'S2', priceCents: 1000 }),
      obs({ observationId: 'b1', productId: 'B', storeId: 'S1', priceCents: 1000 }),
      obs({ observationId: 'b2', productId: 'B', storeId: 'S2', priceCents: 400 }),
    ]
    const result = compareBasket({
      lines: [line('l1', 'A'), line('l2', 'B')],
      products, stores: [store('S1', 150), store('S2', 250)], observations,
      eligibility, selectedStoreIds: ['S1', 'S2'],
      trip: { ...fixtureTrip, otherIncrementalCashCents: 0, minimumNetSavingsCents: 0 },
    })
    const single = result.oneStorePlans.find((p) => p.candidateStoreIds[0] === 'S1')!
    expect(single.feesCents).toBe(150)
    expect(single.shoppingCostCents).toBe(2150)
    const split = result.bestSplit!
    expect(split.feesCents).toBe(400)
    expect(split.shoppingCostCents).toBe(1000 + 400 + 400)
  })
})

describe('06.13 to 06.18 travel, money and units', () => {
  it('10 extra miles at 25 mpg and 350 cents per gallon is 140 cents of fuel', () => {
    const cost = computeTripCost({ ...DEFAULT_TRIP_SETTINGS, extraMiles: 10, mpg: 25, fuelPriceCentsPerGallon: 350, incrementalTollsCents: 0, incrementalParkingCents: 0, otherIncrementalCashCents: 0 })
    expect(cost.fuelCents).toBe(140)
    expect(cost.extraCashTripCostCents).toBe(140)
  })

  it('30 minutes valued at 2000 cents per hour is 1000 cents, and only counts when enabled', () => {
    const off = computeTripCost({ ...DEFAULT_TRIP_SETTINGS, extraMinutes: 30, timeValueCentsPerHour: 2000, countTimeValue: false })
    expect(off.timeValueCents).toBeNull()
    const on = computeTripCost({ ...DEFAULT_TRIP_SETTINGS, extraMinutes: 30, timeValueCentsPerHour: 2000, countTimeValue: true })
    expect(on.timeValueCents).toBe(1000)
  })

  it('rejects invalid trip inputs instead of producing a number', () => {
    expect(validateTrip({ ...DEFAULT_TRIP_SETTINGS, mpg: 0 }).mpg).toBeDefined()
    expect(validateTrip({ ...DEFAULT_TRIP_SETTINGS, mpg: -5 }).mpg).toBeDefined()
    expect(validateTrip({ ...DEFAULT_TRIP_SETTINGS, extraMiles: -1 }).extraMiles).toBeDefined()
    expect(validateTrip({ ...DEFAULT_TRIP_SETTINGS, fuelPriceCentsPerGallon: Number.NaN }).fuelPriceCentsPerGallon).toBeDefined()
    expect(computeTripCost({ ...DEFAULT_TRIP_SETTINGS, mpg: 0 }).valid).toBe(false)
  })

  it('a negative net saving stays negative and never qualifies', () => {
    const result = compareBasket(baseInput({ trip: { ...fixtureTrip, otherIncrementalCashCents: 900, minimumNetSavingsCents: 0 } }))
    expect(result.decision.netCashSavingsCents).toBe(470 - 900)
    expect(result.decision.kind).toBe('stay_at_one_store')
  })

  it('threshold equality with a positive benefit qualifies', () => {
    const result = compareBasket(baseInput({ trip: { ...fixtureTrip, minimumNetSavingsCents: 270 } }))
    expect(result.decision.decisionBasisCents).toBe(270)
    expect(result.decision.kind).toBe('extra_stop_meets_threshold')
  })

  it('does not convert mass ounces into fluid ounces', () => {
    expect(convertAmount(16, 'oz_mass', 'US_fl_oz').value).toBeNull()
    expect(convertAmount(16, 'oz_mass', 'US_fl_oz').error).toContain('density')
    expect(convertAmount(1, 'lb_mass', 'oz_mass').value).toBeCloseTo(16, 6)
  })

  it('rejects a currency mismatch rather than comparing across currencies', () => {
    const products = { A: product('A') }
    const result = compareBasket({
      lines: [line('l1', 'A')], products, stores: [store('S1')],
      observations: [obs({ observationId: 'a1', productId: 'A', storeId: 'S1', priceCents: 500, currency: 'CAD' })],
      eligibility, selectedStoreIds: ['S1'], trip: fixtureTrip,
    })
    expect(result.baseline).toBeNull()
  })

  it('adds money in integer cents with no decimal drift', () => {
    expect(parseDollarsToCents('0.10').cents! + parseDollarsToCents('0.20').cents!).toBe(30)
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(-2.5)).toBe(-2)
    expect(parseDollarsToCents('').cents).toBeNull()
    expect(parseDollarsToCents('4.555').error).toBeTruthy()
    let running = 0
    for (let i = 0; i < 1000; i += 1) running += parseDollarsToCents('0.07').cents!
    expect(running).toBe(7000)
  })
})
