/**
 * Regression tests for the defects found by an independent Gemini 3.1 Pro review of the engine on
 * 2026-09-21. Each test names the finding it locks down. See docs/11_AI_DISCLOSURE_LOG.md.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIET_CONFIG,
  assessProduct,
  evaluateNutritionTarget,
  readCarnivore,
  readGroup,
  type DietConfig,
  type NutritionEvidence,
} from '../domain/diet'
import { packagesRequired } from '../domain/units'

const AT = '2026-09-21T12:00:00-05:00'

function config(overrides: Partial<DietConfig> = {}): DietConfig {
  return { ...DEFAULT_DIET_CONFIG, ...overrides }
}

function evidence(ingredientsText: string | null, overrides: Partial<NutritionEvidence> = {}): NutritionEvidence {
  return {
    recordId: 'test', sourceKind: 'manufacturer_label', displayName: 'Test', brand: null,
    sourceUrl: 'https://example.invalid', sourceDate: null, retrievedOn: '2026-09-21',
    basis: 'per_serving', servingAmount: null, servingUnit: null, servingGrams: null,
    nutrients: {}, ingredientsText, manufacturerClaims: [], containsEvidence: [],
    gtinUpc: null, currentLabelVerified: false, note: null, ...overrides,
  }
}

describe('Finding 1: a requirement smaller than the rounding epsilon returned zero packages', () => {
  it('still buys at least one package for any positive requirement', () => {
    const tiny = packagesRequired(5e-10, 'g', 1, 'g')
    expect(tiny.packages).toBe(1)
    expect(tiny.error).toBeNull()
  })

  it('does not change normal package math', () => {
    expect(packagesRequired(20, 'oz_mass', 16, 'oz_mass').packages).toBe(2)
    expect(packagesRequired(32, 'oz_mass', 16, 'oz_mass').packages).toBe(2)
    expect(packagesRequired(3, 'g', 0.1, 'g').packages).toBe(30)
  })
})

describe('Finding 2: ingredient text that reads as an empty list must not become a match', () => {
  it('returns unresolved rather than absent when nothing parses', () => {
    expect(readGroup('...', 'dairy').presence).toBe('unresolved')
    expect(readCarnivore('...', DEFAULT_DIET_CONFIG.carnivore).presence).toBe('unresolved')
  })

  it('reports unknown, not match, for every rule type', () => {
    expect(assessProduct('x', evidence('...'), config({ dairyFree: true }), AT).status).toBe('unknown')
    expect(assessProduct('x', evidence('...'), config({ pattern: 'vegan' }), AT).status).toBe('unknown')
    expect(assessProduct('x', evidence('...'), config({ customExclusions: ['aspartame'] }), AT).status).toBe('unknown')
  })
})

describe('Finding 3: a plant milk was being read as an animal food by the carnivore rule', () => {
  it('does not accept coconut milk as an animal food', () => {
    const result = assessProduct('x', evidence('COCONUT MILK, WATER, SALT.'), config({ pattern: 'carnivore' }), AT)
    expect(result.status).toBe('does_not_match')
  })

  it('still accepts a genuine animal food', () => {
    const result = assessProduct('x', evidence('CULTURED NON FAT MILK, SALT.'), config({ pattern: 'carnivore' }), AT)
    expect(result.status).toBe('match')
  })
})

describe('Finding 4: plant analogues other than milk were wrongly counted as dairy', () => {
  it('does not treat coconut cream, cashew cheese or oat creamer as dairy', () => {
    expect(readGroup('COCONUT CREAM, WATER.', 'dairy').presence).toBe('absent')
    expect(readGroup('CASHEW CHEESE, SALT.', 'dairy').presence).toBe('absent')
    expect(readGroup('OAT CREAMER, WATER.', 'dairy').presence).toBe('absent')
    expect(assessProduct('x', evidence('COCONUT CREAM, WATER.'), config({ pattern: 'vegan' }), AT).status).toBe('match')
  })
})

describe('Finding 5: buttermilk slipped past the dairy rules entirely', () => {
  it('reads buttermilk as dairy despite the compound word', () => {
    expect(readGroup('CULTURED NONFAT BUTTERMILK.', 'dairy').presence).toBe('present')
    expect(assessProduct('x', evidence('CULTURED NONFAT BUTTERMILK.'), config({ dairyFree: true }), AT).status).toBe('does_not_match')
    expect(assessProduct('x', evidence('CULTURED NONFAT BUTTERMILK.'), config({ pattern: 'vegan' }), AT).status).toBe('does_not_match')
  })

  it('also catches milk solids and kefir', () => {
    expect(readGroup('SUGAR, MILK SOLIDS, COCOA.', 'dairy').presence).toBe('present')
    expect(readGroup('KEFIR CULTURES, WATER.', 'dairy').presence).toBe('present')
  })
})

describe('Finding 6: a zero gram serving divided to Infinity and forced a positive match', () => {
  it('reports unknown instead of matching on a division by zero', () => {
    const result = evaluateNutritionTarget(
      { id: 't', nutrient: 'energy_kcal', op: 'gte', value: 10, basis: 'per_100g' },
      evidence(null, { basis: 'per_serving', servingGrams: 0, nutrients: { energy_kcal: 5 } }),
    )
    expect(result.status).toBe('unknown')
    expect(result.reason).toContain('usable serving mass')
  })

  it('still converts when a real serving mass is recorded', () => {
    const result = evaluateNutritionTarget(
      { id: 't', nutrient: 'energy_kcal', op: 'gte', value: 10, basis: 'per_100g' },
      evidence(null, { basis: 'per_serving', servingGrams: 50, nutrients: { energy_kcal: 5 } }),
    )
    expect(result.status).toBe('match')
    expect(result.reason).toContain('50 g serving')
  })
})
