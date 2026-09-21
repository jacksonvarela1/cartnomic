import { useState } from 'react'
import { Eye, ListChecks, Plus, ShieldAlert, X } from 'lucide-react'
import { useApp } from '../state/store'
import { evidenceLibrary } from '../domain/catalog'
import {
  NUTRIENT_LABEL,
  PATTERN_LABEL,
  PREFERENCE_GUIDE_PATTERNS,
  RULE_VERSION,
  assessProduct,
  isCustomCarnivore,
  patternsConflict,
  type NutrientKey,
  type NutritionTarget,
  type PatternId,
} from '../domain/diet'
import { Banner, Field, PageIntro, StatusPill, WhyPanel } from '../components/ui'

const PATTERNS: PatternId[] = [
  'none', 'vegetarian', 'vegan', 'pescatarian', 'paleo', 'keto_low_carb', 'carnivore', 'mediterranean', 'flexitarian',
]

const NUTRIENTS: NutrientKey[] = ['protein_g', 'sodium_mg', 'added_sugars_g', 'carbohydrate_g', 'energy_kcal']

export default function PreferencesPage() {
  const { state, setDiet, dietConflicts, clockIso, activeRuleCount } = useApp()
  const diet = state.diet
  const [exclusionText, setExclusionText] = useState('')
  const [draft, setDraft] = useState<NutritionTarget>({
    id: 'target-1', nutrient: 'protein_g', op: 'gte', value: 20, basis: 'per_serving',
  })
  const [comparePattern, setComparePattern] = useState<PatternId>('none')

  const crossPatternConflict = comparePattern === 'none' ? null : patternsConflict(diet.pattern, comparePattern)

  function addExclusion() {
    const term = exclusionText.trim()
    if (term === '') return
    setDiet((d) => (d.customExclusions.includes(term) ? d : { ...d, customExclusions: [...d.customExclusions, term] }))
    setExclusionText('')
  }

  function addTarget() {
    const id = 'target-' + (diet.nutritionTargets.length + 1) + '-' + draft.nutrient
    setDiet((d) => ({ ...d, nutritionTargets: [...d.nutritionTargets, { ...draft, id }] }))
  }

  return (
    <>
      <PageIntro
        eyebrow="Optional settings"
        title="Your food. Your rules."
        lead="Tell CartNomic what you will and will not buy. It checks each product against the actual ingredient list and shows the evidence behind every answer."
        points={[
          { icon: ListChecks, title: 'Three answers only', text: 'Matches, does not match, or unknown. Unknown never turns into a green check just to look tidy.' },
          { icon: Eye, title: 'Always shows its work', text: 'Every badge opens the ingredient text, the source link and the date it was recorded.' },
          { icon: ShieldAlert, title: 'Not medical advice', text: 'These are shopping filters. CartNomic cannot certify that anything is safe for an allergy.' },
        ]}
      />

      {dietConflicts.map((c) => <Banner key={c} tone="demo">{c}</Banner>)}

      <div className="card">
        <div className="card-head">
          <h2>Baseline pattern</h2>
          <span className="caption">Rule version {RULE_VERSION}</span>
        </div>
        <p className="section-note">
          <strong>Pick one pattern, then adjust it.</strong> Stacking several at once produces a badge that means
          nothing, so CartNomic does not offer that. Everything below is an editable starting point, not a definition
          anyone has to agree with.
        </p>
        <Field label="Dietary pattern" id="pattern">
          <select id="pattern" value={diet.pattern} onChange={(e) => setDiet((d) => ({ ...d, pattern: e.target.value as PatternId }))}>
            {PATTERNS.map((p) => <option key={p} value={p}>{PATTERN_LABEL[p]}</option>)}
          </select>
        </Field>

        {PREFERENCE_GUIDE_PATTERNS.includes(diet.pattern) ? (
          <Banner tone="info">
            {PATTERN_LABEL[diet.pattern]} is a preference guide. CartNomic does not certify individual products as
            compliant with an overall eating pattern, so only your explicit exclusions and numeric targets are checked.
          </Banner>
        ) : null}

        <Field label="Check a second pattern for conflicts" id="compare-pattern"
          hint="Useful when two people share a basket. CartNomic explains the conflict rather than showing both as satisfied.">
          <select id="compare-pattern" value={comparePattern} onChange={(e) => setComparePattern(e.target.value as PatternId)}>
            {PATTERNS.map((p) => <option key={p} value={p}>{PATTERN_LABEL[p]}</option>)}
          </select>
        </Field>
        {crossPatternConflict ? <Banner tone="danger">{crossPatternConflict}</Banner> : null}

        {diet.pattern === 'paleo' ? (
          <fieldset className="stack">
            <legend>Paleo defaults you can edit</legend>
            <p className="caption">These are CartNomic defaults, not a universal or medically endorsed definition.</p>
            {([
              ['excludeGrains', 'Exclude grains'],
              ['excludeLegumes', 'Exclude legumes'],
              ['excludeDairy', 'Exclude dairy'],
              ['excludeRefinedSweeteners', 'Exclude refined sweeteners'],
            ] as const).map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={diet.paleo[key]}
                  onChange={(e) => setDiet((d) => ({ ...d, paleo: { ...d.paleo, [key]: e.target.checked } }))} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {diet.pattern === 'carnivore' ? (
          <fieldset className="stack">
            <legend>Carnivore rule set {isCustomCarnivore(diet.carnivore) ? '(custom)' : '(strict default)'}</legend>
            <p className="caption">
              Strict starts from animal foods only. Changing a toggle relabels your profile as custom. No claim is made
              that every person following this pattern uses the same rules, and no health claim is made at all.
            </p>
            {([
              ['allowDairy', 'Allow dairy'],
              ['allowEggs', 'Allow eggs'],
              ['allowSeafood', 'Allow seafood'],
              ['allowPlantSeasonings', 'Allow plant seasonings such as pepper and garlic'],
            ] as const).map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={diet.carnivore[key]}
                  onChange={(e) => setDiet((d) => ({ ...d, carnivore: { ...d.carnivore, [key]: e.target.checked } }))} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Independent restrictions</h2>
          <label className="check">
            <input type="checkbox" checked={diet.glutenFree} onChange={(e) => setDiet((d) => ({ ...d, glutenFree: e.target.checked }))} />
            <span>
              Gluten free
              <span className="caption" style={{ display: 'block' }}>
                Needs a current exact product manufacturer claim. Wheat free is not gluten free, and oats do not get an
                automatic badge.
              </span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={diet.dairyFree} onChange={(e) => setDiet((d) => ({ ...d, dairyFree: e.target.checked }))} />
            <span>
              Dairy free
              <span className="caption" style={{ display: 'block' }}>
                Needs positive evidence. Milk, whey and casein conflict, and lactose free is not the same as dairy free.
              </span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={diet.onlyConfirmedMatches}
              onChange={(e) => setDiet((d) => ({ ...d, onlyConfirmedMatches: e.target.checked }))} />
            <span>
              Only confirmed matches
              <span className="caption" style={{ display: 'block' }}>
                On: unknown evidence is excluded from plans. Off: unknowns are shown as unknown, never with a green check.
              </span>
            </span>
          </label>
          <Banner tone="demo">
            Check the current package, especially for allergies. CartNomic does not certify allergy safety.
          </Banner>
        </div>

        <div className="card">
          <h2>Ingredient exclusions</h2>
          <Field label="Add an ingredient to exclude" id="exclusion" hint="Matched against the recorded ingredient list. Ambiguous entries stay unknown.">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="exclusion" value={exclusionText} onChange={(e) => setExclusionText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExclusion() } }} placeholder="aspartame" />
              <button type="button" onClick={addExclusion}><Plus size={16} aria-hidden="true" /> Add</button>
            </div>
          </Field>
          <div className="row">
            {diet.customExclusions.length === 0 ? <span className="small muted">No exclusions yet.</span> : null}
            {diet.customExclusions.map((term) => (
              <span key={term} className="pill neutral">
                {term}
                <button type="button" className="icon ghost" aria-label={'Remove ' + term}
                  onClick={() => setDiet((d) => ({ ...d, customExclusions: d.customExclusions.filter((t) => t !== term) }))}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Numeric nutrition targets</h2>
        <p className="small muted">
          A number with a unit and a basis, not a marketing claim. "Protein at least 20 g per labeled serving" is a
          demo setting, not a dietary recommendation.
        </p>
        <div className="grid cols-3">
          <Field label="Nutrient" id="t-nutrient">
            <select id="t-nutrient" value={draft.nutrient} onChange={(e) => setDraft((d) => ({ ...d, nutrient: e.target.value as NutrientKey }))}>
              {NUTRIENTS.map((n) => <option key={n} value={n}>{NUTRIENT_LABEL[n]}</option>)}
            </select>
          </Field>
          <Field label="Comparison" id="t-op">
            <select id="t-op" value={draft.op} onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value as 'gte' | 'lte' }))}>
              <option value="gte">At least</option>
              <option value="lte">At most</option>
            </select>
          </Field>
          <Field label="Value" id="t-value">
            <input id="t-value" type="number" value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: Number(e.target.value) }))} />
          </Field>
          <Field label="Basis" id="t-basis">
            <select id="t-basis" value={draft.basis} onChange={(e) => setDraft((d) => ({ ...d, basis: e.target.value as 'per_serving' | 'per_100g' }))}>
              <option value="per_serving">Per labeled serving</option>
              <option value="per_100g">Per 100 g</option>
            </select>
          </Field>
        </div>
        <div className="row">
          <button type="button" onClick={addTarget}><Plus size={16} aria-hidden="true" /> Add this target</button>
        </div>
        <div className="row">
          {diet.nutritionTargets.map((t) => (
            <span key={t.id} className="pill neutral">
              {NUTRIENT_LABEL[t.nutrient]} {t.op === 'gte' ? 'at least' : 'at most'} {t.value} {t.basis === 'per_serving' ? 'per serving' : 'per 100 g'}
              <button type="button" className="icon ghost" aria-label="Remove target"
                onClick={() => setDiet((d) => ({ ...d, nutritionTargets: d.nutritionTargets.filter((x) => x.id !== t.id) }))}>
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Evidence library</h2>
          <span className="caption">{activeRuleCount} rule{activeRuleCount === 1 ? '' : 's'} active</span>
        </div>
        <p className="section-note">
          <strong>This is the rule engine working on real products.</strong> Five genuine records, two manufacturer
          labels and three USDA entries, checked against whatever you selected above, right now. Turn on Dairy free
          and watch the yogurt fail on its milk ingredient. These are ingredient records, not local prices.
        </p>
        {evidenceLibrary.map((record) => {
          const verdict = assessProduct(record.recordId, record, diet, clockIso)
          return (
            <div key={record.recordId} className="item-row">
              <div className="item-main">
                <span className="item-name">{record.displayName}</span>
                <span className="caption">
                  {record.sourceKind === 'manufacturer_label' ? 'Manufacturer label' : 'USDA FoodData Central'}
                  {' - '}source date {record.sourceDate ?? 'not recorded'}
                  {' - '}retrieved {record.retrievedOn}
                  {record.gtinUpc ? ' - UPC ' + record.gtinUpc : ''}
                </span>
                <div className="row">
                  <StatusPill status={verdict.status} />
                  {record.manufacturerClaims.map((claim) => <span key={claim} className="pill neutral">Manufacturer claim: {claim}</span>)}
                </div>
                {record.note ? <span className="caption">{record.note}</span> : null}
                <WhyPanel assessment={verdict} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
