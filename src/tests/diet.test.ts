import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIET_CONFIG,
  RULE_VERSION,
  assessProduct,
  detectConflicts,
  evaluateNutritionTarget,
  patternsConflict,
  readGroup,
  type DietConfig,
  type NutritionEvidence,
} from '../domain/diet'
import { evidenceById } from '../domain/catalog'

const EVALUATED_AT = '2026-09-21T12:00:00-05:00'

function config(overrides: Partial<DietConfig> = {}): DietConfig {
  return { ...DEFAULT_DIET_CONFIG, ...overrides }
}

const oikos = evidenceById['oikos_triple_zero_plain_32oz_us']
const dietCoke = evidenceById['diet_coke_us_12_fl_oz']
const graftonCheddar = evidenceById['2057648']

function blank(overrides: Partial<NutritionEvidence> = {}): NutritionEvidence {
  return {
    recordId: 'test', sourceKind: 'manufacturer_label', displayName: 'Test', brand: null,
    sourceUrl: 'https://example.invalid', sourceDate: null, retrievedOn: '2026-09-21',
    basis: 'per_serving', servingAmount: null, servingUnit: null, servingGrams: null,
    nutrients: {}, ingredientsText: null, manufacturerClaims: [], containsEvidence: [],
    gtinUpc: null, currentLabelVerified: false, note: null, ...overrides,
  }
}

describe('06.19 the supplied yogurt label', () => {
  it('fails a dairy free rule because it is cultured nonfat milk', () => {
    const result = assessProduct('oikos', oikos, config({ dairyFree: true }), EVALUATED_AT)
    expect(result.status).toBe('does_not_match')
    expect(result.rules.find((r) => r.ruleId === 'independent.dairy_free')!.status).toBe('does_not_match')
  })

  it('carries the real manufacturer gluten free claim without overriding the dairy exclusion', () => {
    const glutenOnly = assessProduct('oikos', oikos, config({ glutenFree: true }), EVALUATED_AT)
    expect(glutenOnly.status).toBe('match')
    const both = assessProduct('oikos', oikos, config({ glutenFree: true, dairyFree: true }), EVALUATED_AT)
    expect(both.status).toBe('does_not_match')
  })

  it('reports a rule version and the source it used', () => {
    const result = assessProduct('oikos', oikos, config({ dairyFree: true }), EVALUATED_AT)
    expect(result.ruleVersion).toBe(RULE_VERSION)
    expect(result.sourceUrl).toContain('oikos.com')
    expect(result.safetyNote).toContain('does not certify allergy safety')
  })
})

describe('06.20 and 06.21 unknown stays unknown', () => {
  it('a product with no ingredient record is unknown, not a match', () => {
    const result = assessProduct('mystery', null, config({ dairyFree: true }), EVALUATED_AT)
    expect(result.status).toBe('unknown')
    const noIngredients = assessProduct('mystery', blank(), config({ customExclusions: ['aspartame'] }), EVALUATED_AT)
    expect(noIngredients.status).toBe('unknown')
  })

  it('lactose free is not automatically dairy free', () => {
    const lactoseFree = blank({
      recordId: 'lactose_free_milk',
      ingredientsText: 'LACTOSE FREE FAT FREE MILK, VITAMIN A PALMITATE, VITAMIN D3, LACTASE ENZYME.',
      manufacturerClaims: ['Lactose Free'],
    })
    const result = assessProduct('lf', lactoseFree, config({ dairyFree: true }), EVALUATED_AT)
    expect(result.status).toBe('does_not_match')
  })

  it('does not treat coconut milk or cocoa butter as dairy', () => {
    expect(readGroup('COCONUT MILK, WATER, GUAR GUM.', 'dairy').presence).toBe('absent')
    expect(readGroup('COCOA BUTTER, COCOA MASS, SUGAR.', 'dairy').presence).toBe('absent')
    expect(readGroup('CULTURED NON FAT MILK.', 'dairy').presence).toBe('present')
  })
})

describe('06.22 and 06.23 unresolved evidence', () => {
  it('unspecified cheese enzymes stay unresolved for a strict vegetarian check', () => {
    const result = assessProduct('cheddar', graftonCheddar, config({ pattern: 'vegetarian' }), EVALUATED_AT)
    expect(result.status).toBe('unknown')
    expect(result.unresolvedFields.join(' ')).toContain('Enzyme source')
  })

  it('plain oats do not earn a gluten free badge without positive evidence', () => {
    const oats = blank({ recordId: 'oats', ingredientsText: 'WHOLE GRAIN ROLLED OATS.' })
    const result = assessProduct('oats', oats, config({ glutenFree: true }), EVALUATED_AT)
    expect(result.status).toBe('unknown')
    expect(result.rules[0].reason).toContain('Oats')
  })

  it('an explicit gluten grain is a definite failure', () => {
    const bread = blank({ recordId: 'bread', ingredientsText: 'ENRICHED WHEAT FLOUR, WATER, YEAST, SALT.' })
    expect(assessProduct('bread', bread, config({ glutenFree: true }), EVALUATED_AT).status).toBe('does_not_match')
  })
})

describe('06.24 and 06.25 pattern conflicts and configurable presets', () => {
  it('will not present vegan and carnivore as both satisfied', () => {
    expect(patternsConflict('vegan', 'carnivore')).toContain('No product can satisfy both')
    const vegan = assessProduct('yogurt', oikos, config({ pattern: 'vegan' }), EVALUATED_AT)
    const carnivore = assessProduct('yogurt', oikos, config({ pattern: 'carnivore' }), EVALUATED_AT)
    expect(vegan.status).toBe('does_not_match')
    expect(carnivore.status).toBe('match')
  })

  it('paleo dairy handling is a visible toggle, not a hidden assumption', () => {
    const excluded = assessProduct('yogurt', oikos, config({ pattern: 'paleo' }), EVALUATED_AT)
    expect(excluded.status).toBe('does_not_match')
    const allowed = assessProduct('yogurt', oikos, config({
      pattern: 'paleo',
      paleo: { ...DEFAULT_DIET_CONFIG.paleo, excludeDairy: false },
    }), EVALUATED_AT)
    expect(allowed.status).toBe('match')
    expect(allowed.ruleVersion).toBe(RULE_VERSION)
  })

  it('carnivore dairy toggle changes the verdict deterministically', () => {
    const strictNoDairy = config({
      pattern: 'carnivore',
      carnivore: { ...DEFAULT_DIET_CONFIG.carnivore, allowDairy: false },
    })
    expect(assessProduct('yogurt', oikos, strictNoDairy, EVALUATED_AT).status).toBe('does_not_match')
    expect(detectConflicts(strictNoDairy).join(' ')).toContain('Custom carnivore')
  })

  it('the supplied Diet Coke label fails strict paleo and strict carnivore', () => {
    expect(assessProduct('d12', dietCoke, config({ pattern: 'paleo' }), EVALUATED_AT).status).toBe('does_not_match')
    expect(assessProduct('d12', dietCoke, config({ pattern: 'carnivore' }), EVALUATED_AT).status).toBe('does_not_match')
    // Natural flavors are unspecified, so a vegan verdict stays unknown rather than a green check.
    expect(assessProduct('d12', dietCoke, config({ pattern: 'vegan' }), EVALUATED_AT).status).toBe('unknown')
  })

  it('a preference guide pattern does not certify a product', () => {
    const result = assessProduct('yogurt', oikos, config({ pattern: 'mediterranean' }), EVALUATED_AT)
    expect(result.preferenceGuideNote).toContain('does not certify individual products')
  })
})

describe('06.26 and 06.27 numeric targets keep their basis', () => {
  it('a missing nutrient is unknown, never zero', () => {
    const result = evaluateNutritionTarget(
      { id: 't1', nutrient: 'sodium_mg', op: 'lte', value: 100, basis: 'per_serving' },
      blank({ nutrients: { protein_g: 10, sodium_mg: null } }),
    )
    expect(result.status).toBe('unknown')
    expect(result.reason).toContain('not zero')
  })

  it('per 100 g values convert to a serving only when the serving mass is known', () => {
    const converted = evaluateNutritionTarget(
      { id: 't2', nutrient: 'protein_g', op: 'gte', value: 5, basis: 'per_serving' },
      graftonCheddar,
    )
    expect(converted.status).toBe('match')
    expect(converted.reason).toContain('Converted from per 100 g')

    const blocked = evaluateNutritionTarget(
      { id: 't3', nutrient: 'protein_g', op: 'gte', value: 1, basis: 'per_100g' },
      dietCoke,
    )
    expect(blocked.status).toBe('unknown')
    expect(blocked.reason).toContain('not an equal mass in grams')
  })

  it('a protein target reads the labeled serving directly', () => {
    const result = evaluateNutritionTarget(
      { id: 't4', nutrient: 'protein_g', op: 'gte', value: 20, basis: 'per_serving' },
      oikos,
    )
    expect(result.status).toBe('does_not_match')
    expect(result.reason).toContain('18')
  })

  it('a carbohydrate target passes without claiming ketosis or health', () => {
    const result = assessProduct('d12', dietCoke, config({
      nutritionTargets: [{ id: 'carb', nutrient: 'carbohydrate_g', op: 'lte', value: 5, basis: 'per_serving' }],
    }), EVALUATED_AT)
    expect(result.status).toBe('match')
    expect(result.safetyNote).toContain('not medical advice')
    expect(JSON.stringify(result)).not.toMatch(/ketosis|healthy|cures/i)
  })
})
