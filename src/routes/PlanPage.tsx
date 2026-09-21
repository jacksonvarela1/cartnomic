import { useState } from 'react'
import { ClipboardCopy, ListTodo, MapPin, Printer, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatCents } from '../domain/money'
import { UNIT_LABEL } from '../domain/units'
import { Banner, EmptyState, PageIntro } from '../components/ui'

export default function PlanPage() {
  const { comparison, stores, productsById, lines, state, toggleChecked, clearChecked, dataMode, clockIso } = useApp()
  const plan = comparison.recommendedPlan
  const [copied, setCopied] = useState(false)
  const storeName = (id: string) => stores.find((s) => s.storeId === id)?.name ?? id

  if (!plan) {
    return (
      <>
        <PageIntro
          eyebrow="Step 3 of 3"
          title="Your shopping list."
          lead="Once a complete plan exists, this becomes a checklist grouped by store that you can tick off while you shop."
        />
        <EmptyState title="There is no complete plan to hand you yet.">
          <p className="small">{comparison.decision.detail}</p>
          <Link className="btn primary" to="/basket">Back to the basket</Link>
        </EmptyState>
      </>
    )
  }

  const byStore = plan.usedStoreIds.map((storeId) => ({
    storeId,
    rows: plan.lines.filter((l) => l.storeId === storeId && l.status === 'priced'),
  }))
  const unpriced = plan.lines.filter((l) => l.status !== 'priced')
  const productName = (lineId: string) => {
    const line = lines.find((l) => l.lineId === lineId)
    const result = plan.lines.find((l) => l.lineId === lineId)
    const chosen = result?.chosenProductId ?? line?.productId ?? lineId
    return productsById[chosen]?.name ?? chosen
  }

  const planText = [
    'CartNomic shopping plan',
    dataMode === 'demo'
      ? 'DEMO SHOPPING PRICES. Sample stores and savings are fictional.'
      : 'Prices are your own imported observations, not independently verified.',
    'Prices as observed on or before ' + new Date(clockIso).toLocaleDateString('en-US') + '. Taxes not included.',
    '',
    ...byStore.flatMap(({ storeId, rows }) => [
      storeName(storeId) + ' (' + formatCents(rows.reduce((sum, r) => sum + (r.lineTotalCents ?? 0), 0)) + ')',
      ...rows.map((r) => '  - ' + productName(r.lineId) + ' x' + r.packages + '  ' + formatCents(r.lineTotalCents)),
      '',
    ]),
    'Overall total: ' + formatCents(plan.shoppingCostCents),
  ].join('\n')

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(planText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Step 3 of 3"
        title="Your shopping list."
        lead="Everything grouped by store, with what each one costs. Tick items off as you go. It survives a refresh, prints, and copies as plain text."
        points={[
          { icon: ListTodo, title: 'Tick as you shop', text: 'Checkmarks save to this device, so closing the tab does not lose your place.' },
          { icon: Printer, title: 'Print or copy', text: 'A print view and a copy as text button, so it still works with no signal in the store.' },
          { icon: MapPin, title: 'Not a driving route', text: 'A list grouped by store. CartNomic has no travel data, so it will not pretend to optimize a route.' },
        ]}
      />

      {dataMode === 'demo' ? (
        <Banner tone="demo">
          Demo shopping prices. Sample stores and savings in this plan are fictional. Printing or copying it carries
          the same notice.
        </Banner>
      ) : null}

      <div className="row between no-print">
        <span className="caption">
          Checked items are saved on this device and survive a refresh.
        </span>
        <div className="row">
          <button type="button" onClick={clearChecked}><RotateCcw size={16} aria-hidden="true" /> Reset checkmarks</button>
          <button type="button" onClick={copyPlan}><ClipboardCopy size={16} aria-hidden="true" /> {copied ? 'Copied' : 'Copy as text'}</button>
          <button type="button" className="primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print view</button>
        </div>
      </div>

      <div className="grid cols-2">
        {byStore.map(({ storeId, rows }) => {
          const subtotal = rows.reduce((sum, r) => sum + (r.lineTotalCents ?? 0), 0)
          return (
            <section key={storeId} className="panel" aria-label={storeName(storeId)}>
              <div className="row between">
                <h2>{storeName(storeId)}</h2>
                <span className="total num">{formatCents(subtotal)}</span>
              </div>
              <span className="caption">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
              <div>
                {rows.map((row) => {
                  const done = Boolean(state.checked[row.lineId])
                  const product = productsById[row.chosenProductId ?? '']
                  return (
                    <label key={row.lineId} className={'checklist-item' + (done ? ' done' : '')}>
                      <input type="checkbox" checked={done} onChange={() => toggleChecked(row.lineId)} />
                      <span className="item-main">
                        <span className="item-name">{productName(row.lineId)}</span>
                        <span className="caption">
                          {row.packages} package{row.packages === 1 ? '' : 's'}
                          {product ? ' of ' + product.packageAmount + ' ' + UNIT_LABEL[product.packageUnit] : ''}
                          {' - '}{formatCents(row.unitPriceCents)} each
                          {row.observedAt ? ' - observed ' + new Date(row.observedAt).toLocaleDateString('en-US') : ''}
                        </span>
                        <span className="row">
                          {row.appliedSale ? <span className="pill good">Sale applied</span> : null}
                          {row.stale ? <span className="pill warn">Price older than your freshness setting</span> : null}
                          {row.overbuyAmount ? <span className="pill warn">Overbuy {row.overbuyAmount} {row.overbuyUnit}</span> : null}
                        </span>
                      </span>
                      <span className="num" style={{ fontWeight: 600 }}>{formatCents(row.lineTotalCents)}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <div className="card">
        <div className="row between">
          <h2>Overall total</h2>
          <span className="total num">{formatCents(plan.shoppingCostCents)}</span>
        </div>
        <p className="small muted">
          Taxes are not included. Estimated savings may change at checkout. Store fees in this plan:{' '}
          {formatCents(plan.feesCents)}.
        </p>
        {unpriced.length > 0 ? (
          <Banner tone="demo">
            {unpriced.length} item{unpriced.length === 1 ? ' is' : 's are'} not priced in this plan and {unpriced.length === 1 ? 'is' : 'are'} not
            counted in the total. They were not removed from your basket.
          </Banner>
        ) : null}
      </div>
    </>
  )
}
