// Deterministic, versioned shopping rules. Every verdict carries evidence, a rule version and the
// fields it could not resolve. Nothing here is medical advice or an allergy safety certification.

export const RULE_VERSION = 'cartnomic-diet-rules-2026-09-21.1'

export type DietStatus = 'match' | 'does_not_match' | 'unknown'

export const STATUS_LABEL: Record<DietStatus, string> = {
  match: 'Matches your rules',
  does_not_match: 'Does not match',
  unknown: 'Unknown',
}

export type NutrientKey =
  | 'energy_kcal'
  | 'protein_g'
  | 'fat_g'
  | 'carbohydrate_g'
  | 'total_sugars_g'
  | 'added_sugars_g'
  | 'sodium_mg'

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  energy_kcal: 'Calories',
  protein_g: 'Protein (g)',
  fat_g: 'Fat (g)',
  carbohydrate_g: 'Total carbohydrate (g)',
  total_sugars_g: 'Total sugars (g)',
  added_sugars_g: 'Added sugars (g)',
  sodium_mg: 'Sodium (mg)',
}

export interface NutritionEvidence {
  recordId: string
  sourceKind: 'usda_fdc' | 'manufacturer_label'
  displayName: string
  brand: string | null
  sourceUrl: string
  sourceDate: string | null
  retrievedOn: string
  basis: 'per_100g' | 'per_serving'
  servingAmount: number | null
  servingUnit: string | null
  servingGrams: number | null
  nutrients: Partial<Record<NutrientKey, number | null>>
  ingredientsText: string | null
  manufacturerClaims: string[]
  containsEvidence: string[]
  gtinUpc: string | null
  currentLabelVerified: boolean
  note: string | null
}

export type PatternId =
  | 'none'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'paleo'
  | 'keto_low_carb'
  | 'carnivore'
  | 'mediterranean'
  | 'flexitarian'

export const PATTERN_LABEL: Record<PatternId, string> = {
  none: 'No dietary pattern',
  vegetarian: 'Vegetarian (lacto ovo default)',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  paleo: 'Paleo',
  keto_low_carb: 'Keto oriented / low carb',
  carnivore: 'Carnivore',
  mediterranean: 'Mediterranean oriented',
  flexitarian: 'Flexitarian',
}

/** Preference guides steer choices. They never certify an individual product. */
export const PREFERENCE_GUIDE_PATTERNS: PatternId[] = ['mediterranean', 'flexitarian']

export interface PaleoOptions {
  excludeGrains: boolean
  excludeLegumes: boolean
  excludeDairy: boolean
  excludeRefinedSweeteners: boolean
}

export interface CarnivoreOptions {
  allowDairy: boolean
  allowEggs: boolean
  allowSeafood: boolean
  allowPlantSeasonings: boolean
}

export interface NutritionTarget {
  id: string
  nutrient: NutrientKey
  op: 'gte' | 'lte'
  value: number
  basis: 'per_serving' | 'per_100g'
}

export interface DietConfig {
  pattern: PatternId
  paleo: PaleoOptions
  carnivore: CarnivoreOptions
  glutenFree: boolean
  dairyFree: boolean
  customExclusions: string[]
  nutritionTargets: NutritionTarget[]
  onlyConfirmedMatches: boolean
}

export const DEFAULT_DIET_CONFIG: DietConfig = {
  pattern: 'none',
  paleo: { excludeGrains: true, excludeLegumes: true, excludeDairy: true, excludeRefinedSweeteners: true },
  carnivore: { allowDairy: true, allowEggs: true, allowSeafood: true, allowPlantSeasonings: false },
  glutenFree: false,
  dairyFree: false,
  customExclusions: [],
  nutritionTargets: [],
  onlyConfirmedMatches: false,
}

export function isCustomCarnivore(options: CarnivoreOptions): boolean {
  const strict = DEFAULT_DIET_CONFIG.carnivore
  return (
    options.allowDairy !== strict.allowDairy ||
    options.allowEggs !== strict.allowEggs ||
    options.allowSeafood !== strict.allowSeafood ||
    options.allowPlantSeasonings !== strict.allowPlantSeasonings
  )
}

// ---------------------------------------------------------------------------
// Ingredient reading
// ---------------------------------------------------------------------------

export type IngredientGroup =
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'egg'
  | 'gelatin'
  | 'honey'
  | 'grain'
  | 'gluten_grain'
  | 'oats'
  | 'legume'
  | 'refined_sweetener'
  | 'non_animal'

export type GroupPresence = 'present' | 'absent' | 'unresolved'

interface GroupRule {
  positive: RegExp[]
  exempt: RegExp[]
}

const GROUP_RULES: Record<IngredientGroup, GroupRule> = {
  meat: {
    positive: [/\bbeef\b/, /\bpork\b/, /\bchicken\b/, /\bturkey\b/, /\blamb\b/, /\bveal\b/, /\bbacon\b/, /\bham\b/, /\bduck\b/, /\bbison\b/, /\bvenison\b/, /\bgoat meat\b/, /\btallow\b/, /\blard\b/, /\bmeat\b/, /\bpoultry\b/, /\bcollagen\b/, /\bbone broth\b/],
    exempt: [/\bcoconut meat\b/, /\bmeat substitute\b/],
  },
  seafood: {
    positive: [/\bfish\b/, /\bsalmon\b/, /\btuna\b/, /\bshrimp\b/, /\banchov/, /\bcod\b/, /\btilapia\b/, /\bcrab\b/, /\blobster\b/, /\bsardine/, /\bshellfish\b/, /\bsquid\b/, /\boyster/],
    exempt: [],
  },
  dairy: {
    positive: [/\bmilk\b/, /\bcream\b/, /\bbutter\b/, /\bcheese\b/, /\bwhey\b/, /\bcasein/, /\blactose\b/, /\bghee\b/, /\byogurt\b/, /\bmilkfat\b/, /\bbutterfat\b/, /\bdairy\b/],
    exempt: [/\b(coconut|almond|soy|soya|oat|rice|cashew|hemp|pea|flax|macadamia|walnut|hazelnut)\s+milk\b/, /\bcocoa butter\b/, /\b(peanut|almond|cashew|sunflower|shea|apple|seed|nut)\s+butter\b/, /\bmilk thistle\b/, /\bnon[- ]?dairy\b/, /\bdairy[- ]free\b/],
  },
  egg: { positive: [/\begg\b/, /\beggs\b/, /\balbumen\b/, /\bovalbumin\b/], exempt: [/\begg substitute\b/] },
  gelatin: { positive: [/\bgelatin\b/], exempt: [/\bvegetable gelatin\b/, /\bagar\b/] },
  honey: { positive: [/\bhoney\b/], exempt: [/\bhoneydew\b/, /\bhoney\s?dew\b/] },
  grain: {
    positive: [/\bwheat\b/, /\bbarley\b/, /\brye\b/, /\boats?\b/, /\brice\b/, /\bcorn\b/, /\bmaize\b/, /\bmalt\b/, /\bsemolina\b/, /\bspelt\b/, /\bfarro\b/, /\bcouscous\b/, /\bbulgur\b/, /\bquinoa\b/, /\bflour\b/, /\bcornstarch\b/, /\bcorn starch\b/],
    exempt: [],
  },
  gluten_grain: {
    positive: [/\bwheat\b/, /\bbarley\b/, /\brye\b/, /\bmalt\b/, /\bsemolina\b/, /\bspelt\b/, /\btriticale\b/, /\bfarro\b/, /\bcouscous\b/, /\bbulgur\b/],
    exempt: [/\bbuckwheat\b/],
  },
  oats: { positive: [/\boats?\b/, /\boatmeal\b/], exempt: [] },
  legume: {
    positive: [/\bsoy\b/, /\bsoya\b/, /\bsoybean/, /\bpeanut/, /\blentil/, /\bchickpea/, /\bgarbanzo/, /\bbeans?\b/, /\bpea protein\b/, /\bedamame\b/],
    exempt: [/\bcocoa bean/, /\bcoffee bean/, /\bvanilla bean/, /\btonka bean/],
  },
  refined_sweetener: {
    positive: [/\bsugar\b/, /\bcane syrup\b/, /\bcorn syrup\b/, /\bhigh fructose\b/, /\bdextrose\b/, /\bmaltodextrin\b/, /\bsucralose\b/, /\baspartame\b/, /\bsaccharin\b/, /\bacesulfame\b/, /\bcane juice\b/],
    exempt: [/\bsugar cane fiber\b/],
  },
  non_animal: { positive: [], exempt: [] },
}

// Phrases that are genuinely ambiguous. They block a positive match instead of inventing one.
const AMBIGUOUS: Array<{ re: RegExp; affects: IngredientGroup[]; note: string }> = [
  { re: /\benzymes?\b/, affects: ['meat', 'dairy', 'non_animal'], note: 'Enzyme source is not specified, so an animal origin cannot be ruled out.' },
  { re: /natural flavou?rs?/, affects: ['meat', 'seafood', 'dairy', 'egg', 'non_animal'], note: 'Natural flavor sources are not specified.' },
  { re: /artificial flavou?rs?/, affects: ['non_animal'], note: 'Artificial flavor composition is not specified.' },
  { re: /\bflavou?ring\b/, affects: ['meat', 'dairy', 'non_animal'], note: 'Flavoring composition is not specified.' },
  { re: /\bspices\b/, affects: ['non_animal'], note: 'The spice blend is not itemized.' },
  { re: /\bmono ?- ?and ?diglycerides\b/, affects: ['meat', 'dairy'], note: 'Mono and diglycerides can be plant or animal derived.' },
  { re: /\bprocessing aid/, affects: ['non_animal'], note: 'Processing aids are not itemized.' },
]

// Ingredients that are recognizably not animal foods. Used by the carnivore rule set, which needs
// positive identification rather than an assumption about anything it does not recognize.
const KNOWN_NON_ANIMAL = [
  /\bcaramel color\b/, /\baspartame\b/, /\bphosphoric acid\b/, /\bpotassium benzoate\b/, /\bcitric acid\b/,
  /\bcaffeine\b/, /\bsugar\b/, /\bcorn\b/, /\bwheat\b/, /\brice\b/, /\boats?\b/, /\bsoy\b/, /\bpotato\b/,
  /\bcellulose\b/, /\bannatto\b/, /\bnatamycin\b/, /\bstarch\b/, /\bolive oil\b/, /\bvegetable oil\b/,
  /\bcanola\b/, /\bsunflower\b/, /\btruffle\b/, /\bcocoa\b/, /\bfruit\b/, /\bvegetable\b/, /\bpectin\b/,
  /\bcarrageenan\b/, /\bstevia\b/, /\bsucralose\b/, /\bmaltodextrin\b/, /\bdextrose\b/, /\bcarbonated water\b/,
]
const CARNIVORE_NEUTRAL = [/\bwater\b/, /\bsalt\b/, /\bsea salt\b/, /\bcultures?\b/, /\bthermophilus\b/, /\bbulgaricus\b/, /\bacidophilus\b/]
const ANIMAL_FOODS = [
  /\bbeef\b/, /\bpork\b/, /\bchicken\b/, /\bturkey\b/, /\blamb\b/, /\bveal\b/, /\bbacon\b/, /\bham\b/, /\bduck\b/,
  /\bfish\b/, /\bsalmon\b/, /\btuna\b/, /\bshrimp\b/, /\bmilk\b/, /\bcream\b/, /\bbutter\b/, /\bcheese\b/,
  /\bwhey\b/, /\bcasein/, /\byogurt\b/, /\begg\b/, /\beggs\b/, /\btallow\b/, /\blard\b/, /\bgelatin\b/, /\bcollagen\b/,
]

export function splitIngredients(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\[\]]/g, ' ')
    .split(/[,.;:()&]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    // Single characters are organism abbreviations such as the S. and L. in a culture list, not ingredients.
    .filter((s) => s.length > 1 && s !== 'and')
}

function phraseMatchesGroup(phrase: string, rule: GroupRule): boolean {
  let stripped = phrase
  for (const exempt of rule.exempt) stripped = stripped.replace(exempt, ' ')
  return rule.positive.some((re) => re.test(stripped))
}

export interface GroupReading {
  presence: GroupPresence
  matchedPhrases: string[]
  unresolvedNotes: string[]
}

export function readGroup(ingredientsText: string | null, group: IngredientGroup): GroupReading {
  if (!ingredientsText || ingredientsText.trim() === '') {
    return { presence: 'unresolved', matchedPhrases: [], unresolvedNotes: ['No ingredient list is recorded for this product.'] }
  }
  const phrases = splitIngredients(ingredientsText)
  const rule = GROUP_RULES[group]
  const matched = phrases.filter((p) => phraseMatchesGroup(p, rule))
  if (matched.length > 0) return { presence: 'present', matchedPhrases: matched, unresolvedNotes: [] }

  const notes: string[] = []
  for (const amb of AMBIGUOUS) {
    if (!amb.affects.includes(group)) continue
    if (phrases.some((p) => amb.re.test(p))) notes.push(amb.note)
  }
  if (notes.length > 0) return { presence: 'unresolved', matchedPhrases: [], unresolvedNotes: notes }
  return { presence: 'absent', matchedPhrases: [], unresolvedNotes: [] }
}

/** Carnivore needs positive identification of every ingredient as an animal food or a neutral. */
export function readCarnivore(ingredientsText: string | null, options: CarnivoreOptions): GroupReading {
  if (!ingredientsText || ingredientsText.trim() === '') {
    return { presence: 'unresolved', matchedPhrases: [], unresolvedNotes: ['No ingredient list is recorded for this product.'] }
  }
  const phrases = splitIngredients(ingredientsText)
  const offending: string[] = []
  const notes: string[] = []
  for (const phrase of phrases) {
    if (ANIMAL_FOODS.some((re) => re.test(phrase))) continue
    if (CARNIVORE_NEUTRAL.some((re) => re.test(phrase))) continue
    if (options.allowPlantSeasonings && /\b(pepper|spice|herb|garlic|onion|paprika)\b/.test(phrase)) continue
    if (KNOWN_NON_ANIMAL.some((re) => re.test(phrase))) { offending.push(phrase); continue }
    const amb = AMBIGUOUS.find((a) => a.affects.includes('non_animal') && a.re.test(phrase))
    if (amb) { notes.push(amb.note); continue }
    notes.push('"' + phrase + '" could not be identified as an animal food.')
  }
  if (offending.length > 0) return { presence: 'present', matchedPhrases: offending, unresolvedNotes: notes }
  if (notes.length > 0) return { presence: 'unresolved', matchedPhrases: [], unresolvedNotes: notes }
  return { presence: 'absent', matchedPhrases: [], unresolvedNotes: [] }
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

export interface RuleResult {
  ruleId: string
  ruleLabel: string
  status: DietStatus
  reason: string
  evidenceRefs: string[]
  unresolvedFields: string[]
}

export interface DietAssessment {
  productId: string
  recordId: string | null
  status: DietStatus
  ruleVersion: string
  evaluatedAt: string
  rules: RuleResult[]
  unresolvedFields: string[]
  sourceLabel: string
  sourceUrl: string | null
  sourceDate: string | null
  preferenceGuideNote: string | null
  safetyNote: string
}

const SAFETY_NOTE =
  'Matches selected shopping rules, not medical advice. Check the current product label, especially for allergies. CartNomic does not certify allergy safety.'

function exclusionRule(
  ruleId: string,
  ruleLabel: string,
  reading: GroupReading,
  evidence: NutritionEvidence | null,
): RuleResult {
  const refs = evidence ? [evidence.recordId] : []
  if (reading.presence === 'present') {
    return {
      ruleId,
      ruleLabel,
      status: 'does_not_match',
      reason: 'Ingredient list contains: ' + reading.matchedPhrases.join('; ') + '.',
      evidenceRefs: refs,
      unresolvedFields: [],
    }
  }
  if (reading.presence === 'unresolved') {
    return {
      ruleId,
      ruleLabel,
      status: 'unknown',
      reason: reading.unresolvedNotes.join(' ') || 'The available evidence cannot settle this rule.',
      evidenceRefs: refs,
      unresolvedFields: reading.unresolvedNotes,
    }
  }
  return {
    ruleId,
    ruleLabel,
    status: 'match',
    reason: 'No matching ingredient appears in the recorded ingredient list.',
    evidenceRefs: refs,
    unresolvedFields: [],
  }
}

function claimPresent(evidence: NutritionEvidence | null, pattern: RegExp): boolean {
  if (!evidence) return false
  return evidence.manufacturerClaims.some((c) => pattern.test(c.toLowerCase()))
}

export function evaluateNutritionTarget(
  target: NutritionTarget,
  evidence: NutritionEvidence | null,
): RuleResult {
  const label =
    NUTRIENT_LABEL[target.nutrient] + ' ' + (target.op === 'gte' ? 'at least ' : 'at most ') + target.value +
    ' ' + (target.basis === 'per_serving' ? 'per labeled serving' : 'per 100 g')
  if (!evidence) {
    return { ruleId: target.id, ruleLabel: label, status: 'unknown', reason: 'No nutrition record is linked to this product.', evidenceRefs: [], unresolvedFields: ['nutrition record'] }
  }
  const raw = evidence.nutrients[target.nutrient]
  if (raw === undefined || raw === null) {
    return { ruleId: target.id, ruleLabel: label, status: 'unknown', reason: NUTRIENT_LABEL[target.nutrient] + ' is not recorded in this source. A missing value is not zero.', evidenceRefs: [evidence.recordId], unresolvedFields: [target.nutrient] }
  }

  let value = raw
  let basisNote = ''
  if (evidence.basis !== target.basis) {
    if (evidence.basis === 'per_100g' && target.basis === 'per_serving') {
      if (evidence.servingGrams === null) {
        return { ruleId: target.id, ruleLabel: label, status: 'unknown', reason: 'Source values are per 100 g and the serving mass in grams is not recorded, so a per serving comparison is not possible.', evidenceRefs: [evidence.recordId], unresolvedFields: ['serving mass in grams'] }
      }
      value = (raw * evidence.servingGrams) / 100
      basisNote = ' Converted from per 100 g using the recorded ' + evidence.servingGrams + ' g serving.'
    } else if (evidence.basis === 'per_serving' && target.basis === 'per_100g') {
      if (evidence.servingGrams === null) {
        return { ruleId: target.id, ruleLabel: label, status: 'unknown', reason: 'Source values are per labeled serving and the serving mass in grams is not recorded, so a per 100 g comparison is not possible. A liquid volume serving is not an equal mass in grams.', evidenceRefs: [evidence.recordId], unresolvedFields: ['serving mass in grams'] }
      }
      value = (raw * 100) / evidence.servingGrams
      basisNote = ' Converted from the recorded ' + evidence.servingGrams + ' g serving.'
    }
  }

  const passes = target.op === 'gte' ? value >= target.value : value <= target.value
  const shown = Math.round(value * 100) / 100
  return {
    ruleId: target.id,
    ruleLabel: label,
    status: passes ? 'match' : 'does_not_match',
    reason: 'Recorded value is ' + shown + ' ' + (target.basis === 'per_serving' ? 'per labeled serving' : 'per 100 g') + '.' + basisNote,
    evidenceRefs: [evidence.recordId],
    unresolvedFields: [],
  }
}

function combine(rules: RuleResult[]): DietStatus {
  if (rules.some((r) => r.status === 'does_not_match')) return 'does_not_match'
  if (rules.some((r) => r.status === 'unknown')) return 'unknown'
  return 'match'
}

export function assessProduct(
  productId: string,
  evidence: NutritionEvidence | null,
  config: DietConfig,
  evaluatedAt: string,
): DietAssessment {
  const rules: RuleResult[] = []
  const ing = evidence?.ingredientsText ?? null
  const contains = (evidence?.containsEvidence ?? []).map((c) => c.toLowerCase())

  const dairyReading: GroupReading = contains.includes('milk')
    ? { presence: 'present', matchedPhrases: ['manufacturer states the product contains milk'], unresolvedNotes: [] }
    : readGroup(ing, 'dairy')

  switch (config.pattern) {
    case 'vegetarian':
      rules.push(exclusionRule('vegetarian.meat', 'No meat or poultry', readGroup(ing, 'meat'), evidence))
      rules.push(exclusionRule('vegetarian.seafood', 'No fish or seafood', readGroup(ing, 'seafood'), evidence))
      rules.push(exclusionRule('vegetarian.gelatin', 'No animal gelatin', readGroup(ing, 'gelatin'), evidence))
      break
    case 'vegan':
      rules.push(exclusionRule('vegan.meat', 'No meat or poultry', readGroup(ing, 'meat'), evidence))
      rules.push(exclusionRule('vegan.seafood', 'No fish or seafood', readGroup(ing, 'seafood'), evidence))
      rules.push(exclusionRule('vegan.dairy', 'No dairy', dairyReading, evidence))
      rules.push(exclusionRule('vegan.egg', 'No eggs', readGroup(ing, 'egg'), evidence))
      rules.push(exclusionRule('vegan.honey', 'No honey', readGroup(ing, 'honey'), evidence))
      rules.push(exclusionRule('vegan.gelatin', 'No animal gelatin', readGroup(ing, 'gelatin'), evidence))
      break
    case 'pescatarian':
      rules.push(exclusionRule('pescatarian.meat', 'No terrestrial meat or poultry', readGroup(ing, 'meat'), evidence))
      break
    case 'paleo':
      if (config.paleo.excludeGrains) rules.push(exclusionRule('paleo.grain', 'No grains', readGroup(ing, 'grain'), evidence))
      if (config.paleo.excludeLegumes) rules.push(exclusionRule('paleo.legume', 'No legumes', readGroup(ing, 'legume'), evidence))
      if (config.paleo.excludeDairy) rules.push(exclusionRule('paleo.dairy', 'No dairy', dairyReading, evidence))
      if (config.paleo.excludeRefinedSweeteners) rules.push(exclusionRule('paleo.sweetener', 'No refined sweeteners', readGroup(ing, 'refined_sweetener'), evidence))
      break
    case 'carnivore': {
      const reading = readCarnivore(ing, config.carnivore)
      rules.push(exclusionRule('carnivore.animal_only', 'Animal foods only', reading, evidence))
      if (!config.carnivore.allowDairy) rules.push(exclusionRule('carnivore.dairy', 'No dairy', dairyReading, evidence))
      if (!config.carnivore.allowEggs) rules.push(exclusionRule('carnivore.egg', 'No eggs', readGroup(ing, 'egg'), evidence))
      if (!config.carnivore.allowSeafood) rules.push(exclusionRule('carnivore.seafood', 'No seafood', readGroup(ing, 'seafood'), evidence))
      break
    }
    case 'keto_low_carb':
    case 'mediterranean':
    case 'flexitarian':
    case 'none':
    default:
      break
  }

  if (config.dairyFree) {
    if (dairyReading.presence === 'present') {
      rules.push(exclusionRule('independent.dairy_free', 'Dairy free', dairyReading, evidence))
    } else if (claimPresent(evidence, /dairy[- ]?free/)) {
      rules.push({ ruleId: 'independent.dairy_free', ruleLabel: 'Dairy free', status: 'match', reason: 'The manufacturer states a dairy free claim on this product page.', evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: [] })
    } else {
      rules.push({
        ruleId: 'independent.dairy_free',
        ruleLabel: 'Dairy free',
        status: 'unknown',
        reason: 'No dairy free claim is recorded. Lactose free is not the same as dairy free, and an absent word is not positive evidence.',
        evidenceRefs: evidence ? [evidence.recordId] : [],
        unresolvedFields: ['manufacturer dairy free claim'],
      })
    }
  }

  if (config.glutenFree) {
    const gluten = readGroup(ing, 'gluten_grain')
    if (gluten.presence === 'present') {
      rules.push(exclusionRule('independent.gluten_free', 'Gluten free', gluten, evidence))
    } else if (claimPresent(evidence, /gluten[- ]?free/)) {
      rules.push({ ruleId: 'independent.gluten_free', ruleLabel: 'Gluten free', status: 'match', reason: 'The manufacturer page carries a gluten free certification claim. This is the manufacturer claim, not a CartNomic certification.', evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: [] })
    } else {
      const oats = readGroup(ing, 'oats')
      rules.push({
        ruleId: 'independent.gluten_free',
        ruleLabel: 'Gluten free',
        status: 'unknown',
        reason: oats.presence === 'present'
          ? 'Oats are listed. Oats do not receive an automatic gluten free badge because cross contact is not established without a specific claim.'
          : 'No gluten free claim is recorded for this exact product. Wheat free is not the same as gluten free, and cross contact is not established.',
        evidenceRefs: evidence ? [evidence.recordId] : [],
        unresolvedFields: ['manufacturer gluten free claim'],
      })
    }
  }

  for (const raw of config.customExclusions) {
    const term = raw.trim()
    if (term === '') continue
    const ruleId = 'exclusion.' + term.toLowerCase()
    if (!ing) {
      rules.push({ ruleId, ruleLabel: 'Exclude ' + term, status: 'unknown', reason: 'No ingredient list is recorded, so this exclusion cannot be checked.', evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: ['ingredient list'] })
      continue
    }
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('\\b' + escaped + '\\b')
    const phrases = splitIngredients(ing)
    const hit = phrases.filter((p) => re.test(p))
    if (hit.length > 0) {
      rules.push({ ruleId, ruleLabel: 'Exclude ' + term, status: 'does_not_match', reason: 'Ingredient list contains: ' + hit.join('; ') + '.', evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: [] })
    } else {
      const ambiguous = AMBIGUOUS.filter((a) => phrases.some((p) => a.re.test(p)))
      if (ambiguous.length > 0) {
        rules.push({ ruleId, ruleLabel: 'Exclude ' + term, status: 'unknown', reason: ambiguous.map((a) => a.note).join(' '), evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: ambiguous.map((a) => a.note) })
      } else {
        rules.push({ ruleId, ruleLabel: 'Exclude ' + term, status: 'match', reason: 'The recorded ingredient list does not contain this term.', evidenceRefs: evidence ? [evidence.recordId] : [], unresolvedFields: [] })
      }
    }
  }

  for (const target of config.nutritionTargets) rules.push(evaluateNutritionTarget(target, evidence))

  const status = rules.length === 0 ? 'match' : combine(rules)
  const unresolvedFields = [...new Set(rules.flatMap((r) => r.unresolvedFields))]

  return {
    productId,
    recordId: evidence?.recordId ?? null,
    status,
    ruleVersion: RULE_VERSION,
    evaluatedAt,
    rules,
    unresolvedFields,
    sourceLabel: evidence
      ? evidence.sourceKind === 'manufacturer_label'
        ? 'Manufacturer label, ' + evidence.displayName
        : 'USDA FoodData Central record ' + evidence.recordId
      : 'No linked nutrition or ingredient record',
    sourceUrl: evidence?.sourceUrl ?? null,
    sourceDate: evidence?.sourceDate ?? null,
    preferenceGuideNote: PREFERENCE_GUIDE_PATTERNS.includes(config.pattern)
      ? PATTERN_LABEL[config.pattern] + ' is a preference guide here. CartNomic does not certify individual products as compliant with an overall eating pattern, so only your explicit exclusions and numeric targets are checked.'
      : null,
    safetyNote: SAFETY_NOTE,
  }
}

/** Two patterns that cannot both be satisfied. Used instead of showing two satisfied badges. */
export function patternsConflict(a: PatternId, b: PatternId): string | null {
  const key = [a, b].sort().join('|')
  const conflicts: Record<string, string> = {
    'carnivore|vegan': 'Vegan excludes every animal food and carnivore allows only animal foods. No product can satisfy both, so CartNomic will not show both as satisfied.',
    'carnivore|vegetarian': 'Vegetarian excludes meat and poultry while carnivore is built on them. These cannot both be satisfied.',
    'carnivore|pescatarian': 'Pescatarian excludes terrestrial meat while a carnivore rule set is built on animal foods generally. Choose one baseline pattern and add exceptions.',
    'paleo|vegan': 'Paleo defaults here exclude grains and legumes, which removes most vegan protein sources. Pick one baseline pattern and set explicit exceptions.',
  }
  return conflicts[key] ?? null
}

export function detectConflicts(config: DietConfig): string[] {
  const out: string[] = []
  if (config.pattern === 'carnivore' && config.dairyFree && config.carnivore.allowDairy) {
    out.push('Your carnivore settings allow dairy but you also selected a dairy free exclusion. The exclusion is treated as the stronger rule and dairy products will not match.')
  }
  if (config.pattern === 'vegan' && !config.dairyFree) {
    // Not a conflict, just a clarification.
  }
  const animalTerms = ['meat', 'beef', 'chicken', 'pork', 'egg', 'eggs', 'fish', 'milk', 'dairy']
  if (config.pattern === 'carnivore') {
    const blocked = config.customExclusions.filter((t) => animalTerms.includes(t.trim().toLowerCase()))
    if (blocked.length >= 3) {
      out.push('Carnivore is selected but you have excluded ' + blocked.join(', ') + '. Very few products can satisfy both. Review your exclusions rather than expecting the optimizer to relax them.')
    }
  }
  if (config.pattern === 'vegan' && config.customExclusions.some((t) => ['soy', 'legume', 'beans', 'nuts'].includes(t.trim().toLowerCase()))) {
    out.push('Vegan with a legume or nut exclusion removes most protein options in this catalog. Results may be empty, and CartNomic will not quietly relax either rule.')
  }
  if (isCustomCarnivore(config.carnivore) && config.pattern === 'carnivore') {
    out.push('Your carnivore profile is customized, so it is labeled Custom carnivore rather than the strict default.')
  }
  return out
}
