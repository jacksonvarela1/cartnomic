import demoFixture from '../data/demo_catalog_and_basket.json'
import usdaSample from '../data/usda_fdc_sample.json'
import labelSamples from '../data/manufacturer_label_samples.json'
import type { NutritionEvidence } from './diet'
import type { BasketLine, PackageUnit, PriceObservation, Product, Store } from './types'

/** The fixture is deterministic QA data. Tests and the demo use this explicit clock, not the wall clock. */
export const DEMO_COMPARISON_CLOCK = '2026-09-02T12:00:00-05:00'

export const DEMO_WARNING = demoFixture.warning

export const demoStores: Store[] = demoFixture.stores.map((s) => ({
  storeId: s.store_id,
  name: s.name,
  retailer: null,
  address: s.address,
  dataMode: 'demo' as const,
  provenance: 'synthetic_demo' as const,
  perTripFeeCents: 0,
  verifiedAt: null,
}))

/**
 * The only evidence link in the demo catalog. The fixture itself names the Diet Coke brand, so the
 * manufacturer can label is attached with an explicit note about what it does and does not cover.
 * Every other demo product stays unknown rather than borrowing a record it does not belong to.
 */
const DEMO_EVIDENCE_LINKS: Record<string, { recordId: string; note: string }> = {
  D12: {
    recordId: 'diet_coke_us_12_fl_oz',
    note:
      'Ingredient and nutrition evidence is the manufacturer label for the 12 fl oz can. The sample 12 pack UPC is unverified and the price in this demo is fictional.',
  },
}

export const demoProducts: Product[] = demoFixture.products.map((p) => ({
  productId: p.product_id,
  name: p.name,
  brand: p.brand,
  gtinUpc: p.gtin_upc,
  packageAmount: p.package_amount,
  packageUnit: p.package_unit as PackageUnit,
  packageCount: p.package_count,
  category: null,
  nutritionRecordId: DEMO_EVIDENCE_LINKS[p.product_id]?.recordId ?? null,
  nutritionLinkNote: DEMO_EVIDENCE_LINKS[p.product_id]?.note ?? null,
  dataMode: 'demo' as const,
  provenance: 'synthetic_demo' as const,
}))

export const demoObservations: PriceObservation[] = demoFixture.observations.map((o) => ({
  observationId: o.observation_id,
  productId: o.product_id,
  storeId: o.store_id,
  currency: o.currency,
  priceCents: o.price_cents,
  salePriceCents: o.sale_price_cents,
  saleStartsAt: null,
  saleEndsAt: null,
  memberRequired: o.member_required,
  couponRequired: false,
  minimumUnits: null,
  observedAt: o.observed_at,
  channel: 'in_store',
  stockStatus: o.stock_status === 'fixture_available' ? ('available_at_observation' as const) : ('unknown' as const),
  dataMode: 'demo' as const,
  provenance: 'synthetic_demo' as const,
  sourceKind: o.source_kind,
  sourceUrl: o.source_url,
  reviewStatus: 'synthetic_demo' as const,
  notes: null,
}))

export const demoBasketLines: BasketLine[] = demoFixture.basket_items.map((b, index) => ({
  lineId: 'demo-line-' + String(index + 1).padStart(2, '0'),
  productId: b.product_id,
  quantityPackages: b.quantity_packages,
  requiredAmount: null,
  requiredUnit: null,
  exactProductLock: b.exact_product_lock,
  acceptableAlternativeIds: b.acceptable_alternative_ids,
  dietExceptionAccepted: false,
}))

export const demoExpectedResults = demoFixture.expected_results

export function productMap(products: Product[]): Record<string, Product> {
  const out: Record<string, Product> = {}
  for (const p of products) out[p.productId] = p
  return out
}

// ---------------------------------------------------------------------------
// Nutrition evidence library, built from the two real public sources in the packet
// ---------------------------------------------------------------------------

const usdaEvidence: NutritionEvidence[] = usdaSample.records.map((r) => ({
  recordId: String(r.fdc_id),
  sourceKind: 'usda_fdc' as const,
  displayName: r.brand_name + ' ' + r.description.toLowerCase(),
  brand: r.brand_name,
  sourceUrl: 'https://fdc.nal.usda.gov/food-details/' + r.fdc_id,
  sourceDate: r.modified_date ?? r.published_date ?? null,
  retrievedOn: r.retrieved_on,
  basis: 'per_100g' as const,
  servingAmount: r.serving_size,
  servingUnit: r.serving_unit,
  servingGrams: r.serving_unit === 'g' ? r.serving_size : null,
  nutrients: {
    protein_g: r.nutrients_per_100g.protein_g ?? null,
    fat_g: r.nutrients_per_100g.fat_g ?? null,
    carbohydrate_g: r.nutrients_per_100g.carbohydrate_g ?? null,
    energy_kcal: r.nutrients_per_100g.energy_kcal ?? null,
    sodium_mg: r.nutrients_per_100g.sodium_mg ?? null,
    total_sugars_g: null,
    added_sugars_g: null,
  },
  ingredientsText: r.ingredients,
  manufacturerClaims: r.diet_certifications ?? [],
  containsEvidence: [],
  gtinUpc: r.gtin_upc,
  currentLabelVerified: r.current_label_verified,
  note: r.nutrition_note,
}))

const labelEvidence: NutritionEvidence[] = labelSamples.records.map((r) => ({
  recordId: r.label_id,
  sourceKind: 'manufacturer_label' as const,
  displayName: r.product_name,
  brand: r.brand,
  sourceUrl: r.source_url,
  sourceDate: r.retrieved_on,
  retrievedOn: r.retrieved_on,
  basis: 'per_serving' as const,
  servingAmount: r.serving_size,
  servingUnit: r.serving_unit,
  servingGrams: r.serving_grams,
  nutrients: {
    energy_kcal: r.nutrition.energy_kcal ?? null,
    protein_g: r.nutrition.protein_g ?? null,
    fat_g: r.nutrition.fat_g ?? null,
    carbohydrate_g: r.nutrition.carbohydrate_g ?? null,
    total_sugars_g: r.nutrition.total_sugars_g ?? null,
    added_sugars_g: r.nutrition.added_sugars_g ?? null,
    sodium_mg: r.nutrition.sodium_mg ?? null,
  },
  ingredientsText: r.ingredients,
  manufacturerClaims: (r as { manufacturer_claims?: string[] }).manufacturer_claims ?? [],
  containsEvidence: (r as { contains_evidence?: string[] }).contains_evidence ?? [],
  gtinUpc: r.gtin_upc,
  currentLabelVerified: false,
  note: r.note,
}))

export const evidenceLibrary: NutritionEvidence[] = [...labelEvidence, ...usdaEvidence]

export const evidenceById: Record<string, NutritionEvidence> = Object.fromEntries(
  evidenceLibrary.map((e) => [e.recordId, e]),
)

export const usdaLimitations: string[] = usdaSample.limitations
export const usdaQuery = usdaSample.query
export const usdaRetrievedOn = usdaSample.retrieved_on
