import { useMemo, useState } from 'react'
import { ArrowRight, Lock, LockOpen, Minus, Plus, Search, ShoppingCart, Store, Target, Trash2, Wallet, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatCents, parseDollarsToCents } from '../domain/money'
import { UNIT_LABEL } from '../domain/units'
import { Banner, EmptyState, Field, InfoTip, PageIntro, StatusPill, WhyPanel } from '../components/ui'
import type { BasketLine } from '../domain/types'

export default function BasketPage() {
  const {
    lines, setLines, products, productsById, stores, selectedStoreIds, setSelectedStoreIds,
    state, setBudgetCents, assess, activeRuleCount, dietConflicts, comparison, loadDemoBasket, addCustomProduct,
    dismissWelcome,
  } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [budgetText, setBudgetText] = useState(state.budgetCents === null ? '' : (state.budgetCents / 100).toFixed(2))
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [expandedAlternatives, setExpandedAlternatives] = useState<string | null>(null)

  const inBasket = new Set(lines.map((l) => l.productId))
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return products.slice(0, 5)
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

  const knownSubtotal = comparison.baseline?.shoppingCostCents ?? null
  const overBudget = state.budgetCents !== null && knownSubtotal !== null && knownSubtotal > state.budgetCents
  const lockedCount = lines.filter((l) => l.exactProductLock).length

  return (
    <>
      {!state.welcomeDismissed ? (
        <section className="welcome" aria-label="How CartNomic works">
          <div className="row between">
            <h2>New here? CartNomic answers one question.</h2>
            <button type="button" className="ghost icon" onClick={dismissWelcome} aria-label="Hide this introduction"
              style={{ color: '#cfe3d9', borderColor: 'transparent', background: 'rgba(255,255,255,0.08)' }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p>
            Is driving to a second grocery store actually worth it for the food you actually want? Most price apps
            answer that by comparing a handful of items. CartNomic compares your whole basket, counts the gas and the
            time, and respects the products you refuse to swap.
          </p>
          <ol>
            <li><strong>Build your basket</strong>Add what you want and lock anything you will not substitute.</li>
            <li><strong>Compare the stores</strong>See one store versus a two store split, after trip costs.</li>
            <li><strong>Shop the plan</strong>Get a checklist grouped by store that you can tick off.</li>
          </ol>
          <div className="row">
            <button type="button" className="primary" onClick={dismissWelcome}>Got it, let me build a basket</button>
          </div>
        </section>
      ) : null}

      <PageIntro
        eyebrow="Step 1 of 3"
        title="Build the basket you actually want."
        lead="This is your shopping list. Add items, set how many you need, and lock the ones you refuse to swap for a cheaper brand."
        points={[
          { icon: ShoppingCart, title: 'What you do here', text: 'Search the catalog, add items, set quantities, and choose which stores to compare.' },
          { icon: Lock, title: 'Why locking matters', text: 'A locked item can never be quietly swapped to make the savings look bigger than they are.' },
          { icon: ArrowRight, title: 'What happens next', text: 'Compare prices every item at every store you ticked, then decide if a second stop pays.' },
        ]}
      />

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
          <span className="caption">{products.length} product{products.length === 1 ? '' : 's'} available</span>
        </div>
        <Field
          label="Search this catalog"
          id="basket-search"
          hint="Type part of a product name. Nothing is matched by guesswork, so if it is not here you can add it as a custom item."
        >
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
          <EmptyState title="This catalog is empty." icon={Store}>
            <p>
              My own prices mode starts empty on purpose, because CartNomic will not invent prices for you. Import your
              own products and prices, or switch to demo prices to try the whole flow first.
            </p>
            <button type="button" className="primary" onClick={loadDemoBasket}>Load the sample basket</button>
          </EmptyState>
        ) : matches.length === 0 ? (
          <div className="stack">
            <p className="small muted">Nothing in this catalog matches that search.</p>
            <button type="button" onClick={addCustomItem}>
              <Plus size={16} aria-hidden="true" /> Add "{query.trim()}" as a custom item
            </button>
            <p className="caption">
              A custom item has no price anywhere, so it will show as unpriced rather than pretending to be matched to a
              real listing.
            </p>
          </div>
        ) : (
          <div className="stack">
            {matches.map((product) => {
              const verdict = assess(product.productId)
              return (
                <div key={product.productId} className="search-result">
                  <div className="item-main">
                    <span className="item-name">{product.name}</span>
                    <span className="caption">
                      {product.packageAmount} {UNIT_LABEL[product.packageUnit]}
                      {product.brand ? ' - ' + product.brand : ''}
                    </span>
                    {activeRuleCount > 0 ? <StatusPill status={verdict.status} /> : null}
                  </div>
                  <button type="button" className="small" onClick={() => addProduct(product.productId)}>
                    <Plus size={16} aria-hidden="true" /> {inBasket.has(product.productId) ? 'One more' : 'Add'}
                  </button>
                </div>
              )
            })}
            {query.trim() !== '' ? (
              <button type="button" className="ghost small" onClick={addCustomItem}>
                <Plus size={15} aria-hidden="true" /> None of these? Add "{query.trim()}" as a custom item
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your basket</h2>
          <span className="caption">
            {lines.length} item{lines.length === 1 ? '' : 's'}
            {lockedCount > 0 ? ', ' + lockedCount + ' locked' : ''}
          </span>
        </div>

        {lines.length === 0 ? (
          <EmptyState title="Your basket is empty." icon={ShoppingCart}>
            <p>Add at least one item above, or load the ready made sample basket to see the whole flow in one click.</p>
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
                      {product ? product.packageAmount + ' ' + UNIT_LABEL[product.packageUnit] + ' per package' : 'Unknown package'}
                      {product?.brand ? ' - ' + product.brand : ''}
                    </span>
                    <div className="row">
                      <button type="button" className="small ghost" onClick={() => toggleLock(line.lineId)} aria-pressed={line.exactProductLock}>
                        {line.exactProductLock ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
                        {line.exactProductLock ? 'Locked to this exact product' : 'Alternatives allowed'}
                      </button>
                      {!line.exactProductLock ? (
                        <button
                          type="button"
                          className="small ghost"
                          onClick={() => setExpandedAlternatives(expandedAlternatives === line.lineId ? null : line.lineId)}
                        >
                          {line.acceptableAlternativeIds.length} alternative{line.acceptableAlternativeIds.length === 1 ? '' : 's'} approved
                        </button>
                      ) : null}
                      {activeRuleCount > 0 ? <StatusPill status={verdict.status} /> : null}
                      {line.dietExceptionAccepted ? <span className="pill warn">You allowed an exception</span> : null}
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
                        This item does not match your current food rules. It has not been removed. Keep it as a
                        deliberate exception, or take it out yourself.
                        {' '}
                        <button
                          type="button"
                          className="small"
                          style={{ marginTop: 8 }}
                          onClick={() => setLines((c) => c.map((l) => (l.lineId === line.lineId ? { ...l, dietExceptionAccepted: true } : l)))}
                        >
                          Keep it anyway
                        </button>
                      </Banner>
                    ) : null}

                    {activeRuleCount > 0 ? <WhyPanel assessment={verdict} /> : null}
                  </div>

                  <div className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
                    <div className="qty">
                      <button type="button" aria-label={'One fewer ' + (product?.name ?? line.productId)} onClick={() => setQuantity(line.lineId, line.quantityPackages - 1)}>
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <span className="value">{line.quantityPackages}</span>
                      <button type="button" aria-label={'One more ' + (product?.name ?? line.productId)} onClick={() => setQuantity(line.lineId, line.quantityPackages + 1)}>
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
          <div className="card-head">
            <h2>
              Stores to compare
              <InfoTip term="stores to compare">
                CartNomic only looks at the stores you tick here. It compares shopping everything at one of them
                against splitting the basket between two of them.
              </InfoTip>
            </h2>
          </div>
          {stores.length === 0 ? (
            <p className="small muted">No stores in this mode yet. Add them on the Sources and data page.</p>
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
                      {store.dataMode === 'demo'
                        ? 'A made up store for testing. Not a real chain.'
                        : store.address ?? 'No address recorded'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              Budget
              <InfoTip term="budget">
                Optional. If you set one, CartNomic tells you whether the cheapest complete basket fits inside it.
                Nothing is blocked or hidden if you go over.
              </InfoTip>
            </h2>
          </div>
          <Field
            label="Weekly grocery budget"
            id="budget"
            hint="Leave blank if you do not want to track one. CartNomic does not assume a budget for you."
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
            <div className={'banner ' + (overBudget ? 'demo' : 'good')}>
              <Wallet size={18} aria-hidden="true" />
              <div>
                Cheapest complete basket is <strong className="num">{formatCents(knownSubtotal)}</strong> against your{' '}
                <strong className="num">{formatCents(state.budgetCents)}</strong> budget.{' '}
                {overBudget ? 'That is over, before tax.' : 'That fits, before tax.'}
              </div>
            </div>
          ) : (
            <p className="small muted">Set a budget to see how the cheapest complete basket compares. Taxes are not included.</p>
          )}
        </div>
      </div>

      <div className="cta-bar no-print">
        <span className="small muted">
          {lines.length === 0
            ? 'Add at least one item to compare.'
            : <><Target size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {lines.length} item{lines.length === 1 ? '' : 's'} ready across {selectedStoreIds.length} store{selectedStoreIds.length === 1 ? '' : 's'}.</>}
        </span>
        <button type="button" className="primary" disabled={lines.length === 0} onClick={() => navigate('/compare')}>
          Compare my basket <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  )
}
