import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEMO_COMPARISON_CLOCK,
  demoBasketLines,
  demoObservations,
  demoProducts,
  demoStores,
  evidenceById,
  productMap,
} from '../domain/catalog'
import { compareBasket, type ComparisonResult, type EngineInput } from '../domain/compare'
import { DEFAULT_DIET_CONFIG, assessProduct, detectConflicts, type DietAssessment, type DietConfig } from '../domain/diet'
import { DEFAULT_ELIGIBILITY } from '../domain/pricing'
import {
  DEFAULT_TRIP_SETTINGS,
  type BasketLine,
  type DataMode,
  type PriceObservation,
  type Product,
  type Store,
  type TripSettings,
} from '../domain/types'

const STORAGE_KEY = 'cartnomic.guest.v1'

export interface PersistedState {
  version: 1
  dataMode: DataMode
  linesByMode: Record<DataMode, BasketLine[]>
  selectedStoreIdsByMode: Record<DataMode, string[]>
  trip: TripSettings
  diet: DietConfig
  budgetCents: number | null
  checked: Record<string, boolean>
  userStores: Store[]
  userProducts: Product[]
  userObservations: PriceObservation[]
  customProducts: Record<DataMode, Product[]>
}

function freshState(): PersistedState {
  return {
    version: 1,
    dataMode: 'demo',
    linesByMode: { demo: demoBasketLines, verified: [] },
    selectedStoreIdsByMode: { demo: ['DEMO_A', 'DEMO_B'], verified: [] },
    trip: DEFAULT_TRIP_SETTINGS,
    diet: DEFAULT_DIET_CONFIG,
    budgetCents: null,
    checked: {},
    userStores: [],
    userProducts: [],
    userObservations: [],
    customProducts: { demo: [], verified: [] },
  }
}

function loadState(): { state: PersistedState; recovered: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { state: freshState(), recovered: false }
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || parsed.version !== 1 || !parsed.linesByMode) {
      return { state: freshState(), recovered: true }
    }
    // Merge over a fresh object so a partial or older record cannot produce undefined fields.
    return { state: { ...freshState(), ...parsed }, recovered: false }
  } catch {
    return { state: freshState(), recovered: true }
  }
}

export interface AppContextValue {
  state: PersistedState
  storageRecovered: boolean
  storageWritable: boolean
  dataMode: DataMode
  clockIso: string
  lines: BasketLine[]
  selectedStoreIds: string[]
  products: Product[]
  productsById: Record<string, Product>
  stores: Store[]
  observations: PriceObservation[]
  comparison: ComparisonResult
  assess: (productId: string) => DietAssessment
  dietConflicts: string[]
  activeRuleCount: number
  setDataMode: (mode: DataMode) => void
  setLines: (updater: (lines: BasketLine[]) => BasketLine[]) => void
  setSelectedStoreIds: (ids: string[]) => void
  setTrip: (updater: (trip: TripSettings) => TripSettings) => void
  setDiet: (updater: (diet: DietConfig) => DietConfig) => void
  setBudgetCents: (cents: number | null) => void
  toggleChecked: (lineId: string) => void
  clearChecked: () => void
  addImported: (payload: { stores?: Store[]; products?: Product[]; observations?: PriceObservation[] }) => void
  addCustomProduct: (name: string) => string
  resetAll: () => void
  loadDemoBasket: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadState, [])
  const [state, setState] = useState<PersistedState>(initial.state)
  const [storageRecovered, setStorageRecovered] = useState(initial.recovered)
  const [storageWritable, setStorageWritable] = useState(true)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setStorageWritable(true)
    } catch {
      setStorageWritable(false)
    }
  }, [state])

  const dataMode = state.dataMode
  const lines = state.linesByMode[dataMode] ?? []
  const selectedStoreIds = state.selectedStoreIdsByMode[dataMode] ?? []

  const products = useMemo(
    () => [...(dataMode === 'demo' ? demoProducts : state.userProducts), ...(state.customProducts?.[dataMode] ?? [])],
    [dataMode, state.userProducts, state.customProducts],
  )
  const stores = dataMode === 'demo' ? demoStores : state.userStores
  const observations = dataMode === 'demo' ? demoObservations : state.userObservations
  const productsById = useMemo(() => productMap(products), [products])

  // Fixtures use an explicit comparison clock so deterministic QA data never expires with the wall clock.
  const clockIso = useMemo(
    () => (dataMode === 'demo' ? DEMO_COMPARISON_CLOCK : new Date().toISOString()),
    [dataMode, observations],
  )

  const assessmentCache = useMemo(() => new Map<string, DietAssessment>(), [state.diet, products, clockIso])

  const assess = useCallback(
    (productId: string): DietAssessment => {
      const cached = assessmentCache.get(productId)
      if (cached) return cached
      const product = productsById[productId]
      const evidence = product?.nutritionRecordId ? evidenceById[product.nutritionRecordId] ?? null : null
      const result = assessProduct(productId, evidence, state.diet, clockIso)
      assessmentCache.set(productId, result)
      return result
    },
    [assessmentCache, productsById, state.diet, clockIso],
  )

  const activeRuleCount = useMemo(() => {
    const d = state.diet
    let count = 0
    if (d.pattern !== 'none') count += 1
    if (d.glutenFree) count += 1
    if (d.dairyFree) count += 1
    count += d.customExclusions.filter((t) => t.trim() !== '').length
    count += d.nutritionTargets.length
    return count
  }, [state.diet])

  const comparison = useMemo<ComparisonResult>(() => {
    const input: EngineInput = {
      lines,
      products: productsById,
      stores,
      observations,
      eligibility: { ...DEFAULT_ELIGIBILITY, clockIso, dataMode },
      selectedStoreIds,
      trip: state.trip,
      productAllowed:
        activeRuleCount === 0
          ? undefined
          : (productId: string) => {
              const verdict = assess(productId)
              if (verdict.status === 'does_not_match') {
                return { allowed: false, reason: 'it does not match your rules (' + verdict.rules.filter((r) => r.status === 'does_not_match').map((r) => r.ruleLabel).join(', ') + ').' }
              }
              if (verdict.status === 'unknown' && state.diet.onlyConfirmedMatches) {
                return { allowed: false, reason: 'the evidence is unknown and you selected only confirmed matches.' }
              }
              return { allowed: true, reason: '' }
            },
    }
    return compareBasket(input)
  }, [lines, productsById, stores, observations, clockIso, dataMode, selectedStoreIds, state.trip, activeRuleCount, assess, state.diet.onlyConfirmedMatches])

  const dietConflicts = useMemo(() => detectConflicts(state.diet), [state.diet])

  const value: AppContextValue = {
    state,
    storageRecovered,
    storageWritable,
    dataMode,
    clockIso,
    lines,
    selectedStoreIds,
    products,
    productsById,
    stores,
    observations,
    comparison,
    assess,
    dietConflicts,
    activeRuleCount,
    setDataMode: (mode) => setState((s) => ({ ...s, dataMode: mode })),
    setLines: (updater) =>
      setState((s) => ({ ...s, linesByMode: { ...s.linesByMode, [s.dataMode]: updater(s.linesByMode[s.dataMode] ?? []) } })),
    setSelectedStoreIds: (ids) =>
      setState((s) => ({ ...s, selectedStoreIdsByMode: { ...s.selectedStoreIdsByMode, [s.dataMode]: ids } })),
    setTrip: (updater) => setState((s) => ({ ...s, trip: updater(s.trip) })),
    setDiet: (updater) => setState((s) => ({ ...s, diet: updater(s.diet) })),
    setBudgetCents: (cents) => setState((s) => ({ ...s, budgetCents: cents })),
    toggleChecked: (lineId) => setState((s) => ({ ...s, checked: { ...s.checked, [lineId]: !s.checked[lineId] } })),
    clearChecked: () => setState((s) => ({ ...s, checked: {} })),
    addImported: ({ stores: newStores, products: newProducts, observations: newObservations }) =>
      setState((s) => ({
        ...s,
        userStores: newStores ? [...s.userStores, ...newStores] : s.userStores,
        userProducts: newProducts ? [...s.userProducts, ...newProducts] : s.userProducts,
        // Observations are append only. A new row never overwrites a past observation.
        userObservations: newObservations ? [...s.userObservations, ...newObservations] : s.userObservations,
        selectedStoreIdsByMode: newStores
          ? { ...s.selectedStoreIdsByMode, verified: [...new Set([...s.selectedStoreIdsByMode.verified, ...newStores.map((x) => x.storeId)])] }
          : s.selectedStoreIdsByMode,
      })),
    addCustomProduct: (name: string) => {
      const productId = 'CUSTOM-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 7)
      const custom: Product = {
        productId, name, brand: null, gtinUpc: null, packageAmount: 1, packageUnit: 'count',
        packageCount: 1, category: 'Custom item', nutritionRecordId: null,
        nutritionLinkNote: 'You added this item by hand. No price observation and no label evidence exist for it.',
        dataMode: state.dataMode, provenance: 'estimate',
      }
      setState((s) => ({ ...s, customProducts: { ...s.customProducts, [s.dataMode]: [...(s.customProducts?.[s.dataMode] ?? []), custom] } }))
      return productId
    },
    resetAll: () => {
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage may be blocked */ }
      setState(freshState())
      setStorageRecovered(false)
    },
    loadDemoBasket: () =>
      setState((s) => ({
        ...s,
        dataMode: 'demo',
        linesByMode: { ...s.linesByMode, demo: demoBasketLines },
        selectedStoreIdsByMode: { ...s.selectedStoreIdsByMode, demo: ['DEMO_A', 'DEMO_B'] },
      })),
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
