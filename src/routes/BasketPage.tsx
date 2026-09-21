import { useMemo, useState } from 'react'
import { Lock, LockOpen, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatCents, parseDollarsToCents } from '../domain/money'
import { UNIT_LABEL } from '../domain/units'
import { Banner, EmptyState, Field, StatusPill, WhyPanel } from '../components/ui'
import type { BasketLine } from '../domain/types'

export default function BasketPage() {
  const {
    lines, setLines, products, productsById, stores, selectedStoreIds, setSelectedStoreIds,
    state, setBudgetCents, assess, activeRuleCount, dietConflicts, comparison, loadDemoBasket, addCustomProduct,
  } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [budgetText, setBudgetText] = useState(state.budgetCents === null ? '' : (state.budgetCents / 100).toFixed(2))
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [expandedAlternatives, setExpandedAlternatives] = useState<string | null>(null)

  const inBasket = new Set(lines.map((l) => l.productId))
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return products.slice(0, 6)
    return products.filter((p) => (p.name + ' ' + (p.brand ?? '')).toLowerCase().includes(q)).slice(0, 8)
  }, [products, query])

  function addProduct(productId: string) {
    setLines((current) => {
      if (current.some((l) => l.productId === productId)) {
        return current.map((l) => (l.productId === productId ? { ...l, quantityPackages: l.quantityPackages + 1 } : l))
      }
      const next: BasketLine = {
        lineId: 'line-' + productId + '-' + current.length,
        productId,
        quantityPackages: 1,
        requiredAmount: null,
        requiredUnit: null,
        exactProductLock: true,
        acceptableAlternativeIds: [],
        dietExceptionAccepted: false,
      }
      return [...current, next]
    })
    setQuery('')
  }

  function addCustomItem() {
    const name = query.trim()
    if (name === '') return
    // A custom item has no price observation anywhere, so it stays visibly unpriced instead of
    // inventing a matched listing.
    const productId = addCustomProduct(name)
    addProduct(productId)
  }

  function setQuantity(lineId: string, quantity: number) {
    setLines((current) =>
      current.flatMap((l) => {
        if (l.lineId !== lineId) return [l]
        if (quantity <= 0) return []
        return [{ ...l, quantityPackages: quantity }]
      }),
    )
  }

  function toggleLock(lineId: string) {
    setLines((current) => current.map((l) => (l.lineId === lineId ? { ...l, exactProductLock: !l.exactProductLock } : l)))
  }

  function toggleAlternative(lineId: string, productId: string) {
    setLines((current) =>
      current.map((l) => {
        if (l.lineId !== lineId) return l
        const has = l.acceptableAlternativeIds.includes(productId)
        return {
          ...l,
          acceptableAlternativeIds: has
            ? l.acceptableAlternativeIds.filter((id) => id !== productId)
            : [...l.acceptableAlternativeIds, productId],
        }
      }),
    )
  }

  function acceptException(lineId: string) {
    setLines((current) => current.map((l) => (l.lineId === lineId ? { ...l, dietExceptionAccepted: true } : l)))
  }

  const knownSubtotal = comparison.baseline?.shoppingCostCents ?? null
  const overBudget = state.budgetCents !== null && knownSubtotal !== null && knownSubtotal > state.budgetCents

  return (
    <>
      <div className="page-head">
        <h1>Build the basket you actually want.</h1>
        <p className="sub">
          Lock the products you will not compromise on, set quantities, then compare complete baskets. Nothing is
          substituted or removed without you doing it.
        </p>
      </div>

      {dietConflicts.length > 0 ? (
        <Banner tone="demo">
          <strong>Your preferences need a decision. </strong>
          {dietConflicts.join(' ')}
        </Banner>
      ) : null}

      {comparison.conflicts.map((conflict) => (
        <Banner key={conflict} tone="danger">{conflict}</Banner>
      ))}

      <div className="card">
        <div className="card-head">
          <h2>Add items</h2>
          <span className="caption">{products.length} product{products.length === 1 ? '' : 's'} in this catalog</span>
        </div>
        <Field label="Search this catalog" id="basket-search" hint="Type a product name. Nothing is matched by guesswork.">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Search size={18} aria-hidden="true" style={{ flex: '0 0 auto', color: 'var(--muted)' }} />
            <input
              id="basket-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="eggs, yogurt, rice"
              autoComplete="off"
            />
          </div>
        </Field>

        {products.length === 0 ? (
          <EmptyState title="This catalog is empty.">
            <p className="small">
              Verified mode starts empty on purpose. Import your own products and price observations, or switch to demo
              prices to try the flow.
            </p>
            <button type="button" className="primary" onClick={loadDemoBasket}>Load the sample basket</button>
          </EmptyState>
        ) : matches.length === 0 ? (
          <div className="stack">
            <p className="small muted">No product in this catalog matches that search.</p>
            <button type="button" onClick={addCustomItem}>
              <Plus size={16} aria-hidden="true" /> Add "{query.trim()}" as a custom item with an unknown price
            </button>
          </div>
        ) : (
          <div className="stack">
            {matches.map((product) => {
              const verdict = assess(product.productId)
              return (
                <div key={product.productId} className="row between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div className="item-main">
                    <span className="item-name">{product.name}</span>
                    <span className="caption">
                      {product.packageAmount} {UNIT_LABEL[product.packageUnit]}
                      {product.brand ? ' - ' + product.brand : ''}
                      {product.gtinUpc ? ' - UPC ' + product.gtinUpc : ' - no verified UPC'}
                    </span>
                    {activeRuleCount > 0 ? <StatusPill status={verdict.status} /> : null}
                  </div>
                  <button type="button" className="small" onClick={() => addProduct(product.productId)}>
                    <Plus size={16} aria-hidden="true" /> {inBasket.has(product.productId) ? 'Add another' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your basket</h2>
          <span className="caption">{lines.length} line{lines.length === 1 ? '' : 's'}</span>
        </div>

        {lines.length === 0 ? (
          <EmptyState title="Your basket is empty.">
            <p className="small">Add at least one item, or load the fictional sample basket to see the whole flow.</p>
            <button type="button" className="primary" onClick={loadDemoBasket}>Load the sample basket</button>
          </EmptyState>
        ) : (
          <div>
            {lines.map((line) => {
              const product = productsById[line.productId]
              const verdict = assess(line.productId)
              const blocked = activeRuleCount > 0 && verdict.status === 'does_not_match' && !line.dietExceptionAccepted
              const alternatives = products.filter((p) => p.productId !== line.productId)
              return (
                <div key={line.lineId} className="item-row">
                  <div className="item-main">
                    <span className="item-name">{product?.name ?? line.productId}</span>
                    <span className="caption">
                      {product ? product.packageAmount + ' ' + UNIT_LABEL[product.packageUnit] : 'Unknown package'}
                      {product?.brand ? ' - ' + product.brand : ''}
                    </span>
                    <div className="row">
                      <button type="button" className="small ghost" onClick={() => toggleLock(line.lineId)} aria-pressed={line.exactProductLock}>
                        {line.exactProductLock ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
                        {line.exactProductLock ? 'Exact product locked' : 'Alternatives allowed'}
                      </button>
                      {!line.exactProductLock ? (
                        <button
                          type="button"
                          className="small ghost"
                          onClick={() => setExpandedAlternatives(expandedAlternatives === line.lineId ? null : line.lineId)}
                        >
                          {line.acceptableAlternativeIds.length} approved alternative{line.acceptableAlternativeIds.length === 1 ? '' : 's'}
                        </button>
                      ) : null}
                      {activeRuleCount > 0 ? <StatusPill status={verdict.status} /> : null}
                      {line.dietExceptionAccepted ? <span className="pill warn">Your exception</span> : null}
                    </div>

                    {expandedAlternatives === line.lineId && !line.exactProductLock ? (
                      <fieldset className="stack" style={{ marginTop: 8 }}>
                        <legend>Alternatives you approve for this line</legend>
                        <p className="caption">Only what you tick here can replace this product. CartNomic never swaps an item on its own.</p>
                        {alternatives.slice(0, 8).map((alt) => (
                          <label key={alt.productId} className="check small">
                            <input
                              type="checkbox"
                              checked={line.acceptableAlternativeIds.includes(alt.productId)}
                              onChange={() => toggleAlternative(line.lineId, alt.productId)}
                            />
                            <span>{alt.name}</span>
                          </label>
                        ))}
                      </fieldset>
                    ) : null}

                    {blocked ? (
                      <Banner tone="danger">
                        This item conflicts with your current preferences. Keep it as an exception or choose another item.
                        {' '}
                        <button type="button" className="small" onClick={() => acceptException(line.lineId)}>Keep it as my exception</button>
                      </Banner>
                    ) : null}

                    {activeRuleCount > 0 ? <WhyPanel assessment={verdict} /> : null}
                  </div>

                  <div className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
                    <div className="qty">
                      <button type="button" aria-label={'Decrease quantity of ' + (product?.name ?? line.productId)} onClick={() => setQuantity(line.lineId, line.quantityPackages - 1)}>
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <span className="value">{line.quantityPackages}</span>
                      <button type="button" aria-label={'Increase quantity of ' + (product?.name ?? line.productId)} onClick={() => setQuantity(line.lineId, line.quantityPackages + 1)}>
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" className="small ghost" onClick={() => setQuantity(line.lineId, 0)}>
                      <Trash2 size={14} aria-hidden="true" /> Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Stores to compare</h2>
          {stores.length === 0 ? (
            <p className="small muted">No stores in this mode yet. Import stores on the Sources and data page.</p>
          ) : (
            <div className="stack">
              {stores.map((store) => (
                <label key={store.storeId} className="check">
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(store.storeId)}
                    onChange={(e) =>
                      setSelectedStoreIds(
                        e.target.checked
                          ? [...selectedStoreIds, store.storeId]
                          : selectedStoreIds.filter((id) => id !== store.storeId),
                      )
                    }
                  />
                  <span>
                    {store.name}
                    <span className="caption" style={{ display: 'block' }}>
                      {store.address ?? 'No address recorded'}
                      {store.dataMode === 'demo' ? ' - fictional sample store' : ' - your record'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Budget</h2>
          <Field
            label="Weekly grocery budget (optional)"
            id="budget"
            hint="Blank by default. CartNomic does not assume a budget for you."
            error={budgetError}
          >
            <input
              id="budget"
              inputMode="decimal"
              value={budgetText}
              placeholder="e.g. 100.00"
              onChange={(e) => {
                setBudgetText(e.target.value)
                const parsed = parseDollarsToCents(e.target.value)
                setBudgetError(parsed.error)
                if (!parsed.error) setBudgetCents(parsed.cents)
              }}
            />
          </Field>
          {state.budgetCents !== null && knownSubtotal !== null ? (
            <p className="small">
              Cheapest complete one store plan: <strong className="num">{formatCents(knownSubtotal)}</strong> against a budget of{' '}
              <strong className="num">{formatCents(state.budgetCents)}</strong>.{' '}
              {overBudget ? 'That is over your budget before tax.' : 'That fits your budget before tax.'}
            </p>
          ) : (
            <p className="small muted">Set a budget to see how the cheapest complete basket compares. Taxes are not included.</p>
          )}
        </div>
      </div>

      <div className="row between">
        <span className="caption">
          {lines.length === 0 ? 'Add at least one item.' : 'Comparison uses only the stores you ticked above.'}
        </span>
        <button type="button" className="primary" disabled={lines.length === 0} onClick={() => navigate('/compare')}>
          Compare my basket
        </button>
      </div>
    </>
  )
}
