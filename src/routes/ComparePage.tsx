import { Calculator, Download, Route, Scale, ShoppingCart, Sliders } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatCents, formatSignedCents, parseDollarsToCents } from '../domain/money'
import { toCsv } from '../domain/importer'
import { Banner, EmptyState, Field, InfoTip, PageIntro, downloadText } from '../components/ui'
import type { Plan } from '../domain/compare'

function planTitle(plan: Plan, storeName: (id: string) => string): string {
  if (plan.candidateStoreIds.length === 1) return 'Everything at ' + storeName(plan.candidateStoreIds[0])
  return 'Split between ' + plan.candidateStoreIds.map(storeName).join(' and ')
}

export default function ComparePage() {
  const { comparison, stores, lines, state, setTrip, dataMode, clockIso } = useApp()
  const { decision, baseline, bestSplit, oneStorePlans, lineMatrix } = comparison
  const storeName = (id: string) => stores.find((s) => s.storeId === id)?.name ?? id
  const trip = state.trip
  const errors = decision.tripCost.errors

  const panels: Plan[] = [...oneStorePlans, ...(bestSplit ? [bestSplit] : [])]

  function exportCsv() {
    const rows = lineMatrix.map((row) => {
      const record: Record<string, unknown> = {
        line_id: row.lineId,
        product_id: row.productId,
        product_name: row.productName,
        quantity_packages: row.quantityPackages,
      }
      for (const store of stores) {
        const cell = row.byStore[store.storeId]
        record[store.name + ' price cents'] = cell?.status === 'priced' ? cell.lineTotalCents : ''
        record[store.name + ' status'] = cell?.status ?? 'not selected'
        record[store.name + ' observed at'] = cell?.observedAt ?? ''
      }
      return record
    })
    const summary = [
      { line_id: 'SUMMARY', product_id: 'data_mode', product_name: dataMode, quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'comparison_clock', product_name: clockIso, quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'baseline_plan', product_name: decision.baselineStoreId ?? 'none', quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'baseline_cost_cents', product_name: decision.baselineCostCents ?? '', quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'candidate_cost_cents', product_name: decision.candidateCostCents ?? '', quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'gross_savings_cents', product_name: decision.grossSavingsCents ?? '', quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'extra_trip_cost_cents', product_name: decision.tripCost.extraCashTripCostCents, quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'net_cash_savings_cents', product_name: decision.netCashSavingsCents ?? '', quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'minimum_net_savings_cents', product_name: decision.thresholdCents, quantity_packages: '' },
      { line_id: 'SUMMARY', product_id: 'taxes', product_name: 'not included', quantity_packages: '' },
      {
        line_id: 'SUMMARY', product_id: 'disclosure',
        product_name: dataMode === 'demo'
          ? 'Demo shopping prices. Sample stores and savings are fictional.'
          : 'Your own recorded prices. Not independently verified by CartNomic.',
        quantity_packages: '',
      },
    ]
    const columns = Object.keys(rows[0] ?? { line_id: '', product_id: '', product_name: '', quantity_packages: '' })
    downloadText('cartnomic-comparison.csv', toCsv([...rows, ...summary], columns))
  }

  if (lines.length === 0) {
    return (
      <>
        <PageIntro
          eyebrow="Step 2 of 3"
          title="Is another stop worth it?"
          lead="This screen compares your whole basket at each store and tells you whether a second stop pays for itself."
        />
        <EmptyState title="There is nothing to compare yet." icon={ShoppingCart}>
          <p>Add at least one item to your basket first.</p>
          <Link className="btn primary" to="/basket">Go build a basket</Link>
        </EmptyState>
      </>
    )
  }

  const net = decision.netCashSavingsCents ?? 0
  const netClass = net > 0 ? 'positive' : net < 0 ? 'negative' : ''

  return (
    <>
      <PageIntro
        eyebrow="Step 2 of 3"
        title="Is another stop worth it?"
        lead="Every item is priced at every store you picked. Then the gas and the time for the extra stop get subtracted, and you get a straight answer."
        points={[
          { icon: Scale, title: 'The rule', text: 'Only a basket where every single item has a price can win. A missing price is never counted as zero.' },
          { icon: Sliders, title: 'You control it', text: 'Change the trip cost or your minimum savings below and the recommendation updates instantly.' },
          { icon: Calculator, title: 'Show your work', text: 'Open How we calculated this for the equations and the full item by item table.' },
        ]}
      />

      {comparison.conflicts.map((conflict) => <Banner key={conflict} tone="danger">{conflict}</Banner>)}

      <section className="decision" aria-label="Recommendation">
        <div className="row between">
          <h2>{decision.headline}</h2>
          <span className="pill ink">{dataMode === 'demo' ? 'Made up demo prices' : 'Your own prices'}</span>
        </div>
        <p className="muted">{decision.detail}</p>

        {decision.kind === 'cannot_compare' || decision.kind === 'no_complete_baseline' ? null : (
          <div className="decision-grid">
            <div className="decision-figure lead">
              <span className="fig-label">
                What you actually keep
                <InfoTip term="what you actually keep">
                  The grocery savings from splitting the basket, minus what the extra drive costs you in cash. This is
                  the number that decides the recommendation.
                </InfoTip>
              </span>
              <span className={'value ' + netClass}>{formatSignedCents(decision.netCashSavingsCents)}</span>
            </div>
            <div className="decision-figure">
              <span className="fig-label">
                Saved on groceries
                <InfoTip term="saved on groceries">
                  How much cheaper the two store plan is than shopping everything at the cheapest single store. Before
                  any driving cost.
                </InfoTip>
              </span>
              <span className="value">{formatSignedCents(decision.grossSavingsCents)}</span>
            </div>
            <div className="decision-figure">
              <span className="fig-label">
                Your minimum to bother
                <InfoTip term="your minimum to bother">
                  You set this below. If the money you keep does not clear it, CartNomic tells you to stay at one
                  store even when the split is technically cheaper.
                </InfoTip>
              </span>
              <span className="value">{formatCents(decision.thresholdCents)}</span>
            </div>
          </div>
        )}

        <div className="decision-lines">
          {decision.baselineStoreId ? (
            <div className="decision-line">
              <span>
                Cheapest single store that has everything: {storeName(decision.baselineStoreId)}
                <InfoTip term="cheapest single store">
                  This is the fair thing to measure against. Comparing to the most expensive store instead would make
                  any savings look bigger than they are.
                </InfoTip>
              </span>
              <span className="num">{formatCents(decision.baselineCostCents)}</span>
            </div>
          ) : null}
          {decision.candidateCostCents !== null && decision.candidateStoreIds.length > 1 ? (
            <div className="decision-line">
              <span>Best two store split: {decision.candidateStoreIds.map(storeName).join(' and ')}</span>
              <span className="num">{formatCents(decision.candidateCostCents)}</span>
            </div>
          ) : null}
          {decision.tripCost.valid ? (
            <div className="decision-line">
              <span>Cost of the extra drive, from your numbers below</span>
              <span className="num">{formatCents(decision.tripCost.extraCashTripCostCents)}</span>
            </div>
          ) : null}
          <div className="decision-line">
            <span>Extra time it takes you</span>
            <span className="num">
              {decision.extraMinutes} min{decision.countsTimeValue ? ', valued and subtracted' : ', shown but not subtracted'}
            </span>
          </div>
          {decision.countsTimeValue && decision.netAfterTimeValueCents !== null ? (
            <div className="decision-line">
              <span>What you keep once your time is priced in</span>
              <span className="num">{formatSignedCents(decision.netAfterTimeValueCents)}</span>
            </div>
          ) : null}
          {decision.savingsPercent !== null ? (
            <div className="decision-line">
              <span>That is this much off the grocery bill</span>
              <span className="num">{decision.savingsPercent.toFixed(1)}%</span>
            </div>
          ) : null}
          <div className="decision-line">
            <span>Taxes</span>
            <span>Not included, so the checkout total will differ</span>
          </div>
        </div>
      </section>

      <div>
        <h2 style={{ marginBottom: 'var(--s2)' }}>The three ways to shop this basket</h2>
        <p className="small muted" style={{ marginBottom: 'var(--s4)' }}>
          A plan only counts as complete when every item on your list has a price at the store it is assigned to.
        </p>
        <div className="grid cols-3">
          {panels.map((plan) => {
            const isRecommended = comparison.recommendedPlan?.planId === plan.planId
            return (
              <section key={plan.planId} className={'panel' + (isRecommended ? ' selected' : '')} aria-label={planTitle(plan, storeName)}>
                <div className="row between">
                  <h3>{planTitle(plan, storeName)}</h3>
                  {isRecommended ? <span className="pill good">Recommended</span> : null}
                </div>
                <div>
                  <span className="caption">
                    {plan.complete ? 'Total for the whole basket' : 'Only the items it does have'}
                    {!plan.complete ? (
                      <InfoTip term="only the items it does have">
                        This store is missing a price for at least one item, so this is not a basket total. Calling it
                        one would make this store look cheaper than it is.
                      </InfoTip>
                    ) : null}
                  </span>
                  <div className={'total num' + (plan.complete ? '' : ' dim')}>
                    {formatCents(plan.complete ? plan.shoppingCostCents : plan.knownItemSubtotalCents)}
                  </div>
                </div>
                {plan.complete ? (
                  <span className="pill good">Has all {plan.lines.length} items</span>
                ) : (
                  <span className="pill warn">
                    Cannot win: missing {plan.missingLineIds.length} item{plan.missingLineIds.length === 1 ? '' : 's'}
                  </span>
                )}
                {plan.feesCents > 0 ? <span className="caption">Includes {formatCents(plan.feesCents)} in store fees.</span> : null}
                {!plan.complete ? (
                  <ul className="caption" style={{ margin: 0, paddingLeft: 18 }}>
                    {plan.lines.filter((l) => l.status !== 'priced').map((l) => (
                      <li key={l.lineId}>{l.reasons[0]}</li>
                    ))}
                  </ul>
                ) : null}
                {plan.stops > 1 ? <span className="caption">Two stops instead of one.</span> : null}
              </section>
            )
          })}
        </div>
      </div>

      <div className="card accent">
        <div className="card-head">
          <h2>Your trip, your numbers</h2>
        </div>
        <p className="section-note">
          <strong>Change anything here and the recommendation above updates as you type.</strong> These are your own
          estimates, not a map service. Extra miles means the extra distance on top of the trip you were making anyway.
        </p>
        <div className="grid cols-3">
          <Field label="Extra miles for the second stop" id="miles" error={errors.extraMiles}>
            <input id="miles" type="number" min={0} step="0.1" value={trip.extraMiles}
              onChange={(e) => setTrip((t) => ({ ...t, extraMiles: Number(e.target.value) }))} />
          </Field>
          <Field label="Your car's miles per gallon" id="mpg" error={errors.mpg}>
            <input id="mpg" type="number" min={0} step="0.1" value={trip.mpg}
              onChange={(e) => setTrip((t) => ({ ...t, mpg: Number(e.target.value) }))} />
          </Field>
          <Field label="Gas price per gallon" id="fuel" error={errors.fuelPriceCentsPerGallon}
            hint={'Works out to ' + formatCents(decision.tripCost.fuelCents) + ' of gas for this trip.'}>
            <input id="fuel" inputMode="decimal" defaultValue={(trip.fuelPriceCentsPerGallon / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, fuelPriceCentsPerGallon: parsed.cents! }))
              }} />
          </Field>
          <Field label="Any tolls or parking" id="tolls" error={errors.incrementalTollsCents}>
            <input id="tolls" inputMode="decimal" defaultValue={(trip.incrementalTollsCents / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, incrementalTollsCents: parsed.cents! }))
              }} />
          </Field>
          <Field label="Extra minutes it adds" id="minutes" error={errors.extraMinutes}>
            <input id="minutes" type="number" min={0} step="1" value={trip.extraMinutes}
              onChange={(e) => setTrip((t) => ({ ...t, extraMinutes: Number(e.target.value) }))} />
          </Field>
          <Field
            label="Least you would accept to bother"
            id="threshold"
            error={errors.minimumNetSavingsCents}
            hint="Try changing this one. It is the fastest way to see the recommendation flip."
          >
            <input id="threshold" inputMode="decimal" defaultValue={(trip.minimumNetSavingsCents / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, minimumNetSavingsCents: parsed.cents! }))
              }} />
          </Field>
        </div>

        <label className="check">
          <input type="checkbox" checked={trip.countTimeValue}
            onChange={(e) => setTrip((t) => ({ ...t, countTimeValue: e.target.checked }))} />
          <span>
            Also subtract what my time is worth
            <span className="caption" style={{ display: 'block' }}>
              Off by default, because putting a dollar value on your own time is a personal call. Time is still shown
              either way.
            </span>
          </span>
        </label>
        {trip.countTimeValue ? (
          <Field label="What an hour of your time is worth" id="timevalue" error={errors.timeValueCentsPerHour}>
            <input id="timevalue" inputMode="decimal" defaultValue={(trip.timeValueCentsPerHour / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, timeValueCentsPerHour: parsed.cents! }))
              }} />
          </Field>
        ) : null}

        {!decision.tripCost.valid ? (
          <Banner tone="danger">
            One of the numbers above does not work, so CartNomic will not show a savings figure rather than guess.
            Check the fields marked in red.
          </Banner>
        ) : null}
      </div>

      <details>
        <summary>How we calculated this</summary>
        <div className="details-body">
          <div className="src-block">
            <p className="small"><strong>Store total</strong> equals every item price added up, plus any fee that store charges per trip.</p>
            <p className="small"><strong>Grocery savings</strong> equals the cheapest complete single store total, minus the split plan total.</p>
            <p className="small"><strong>Gas</strong> equals extra miles divided by miles per gallon, times the price of a gallon.</p>
            <p className="small"><strong>What you keep</strong> equals grocery savings minus the cost of the extra drive.</p>
            <p className="caption">
              Money is held in whole cents and rounded once, at the end of each line, so nothing drifts. The store
              compared against is always the cheapest complete one, never the most expensive.
            </p>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="num">Qty</th>
                  {stores.map((s) => <th key={s.storeId} scope="col" className="num">{s.name}</th>)}
                  <th scope="col">Cheaper at</th>
                </tr>
              </thead>
              <tbody>
                {lineMatrix.map((row) => (
                  <tr key={row.lineId}>
                    <th scope="row" className="rowhead">{row.productName}</th>
                    <td className="num">{row.quantityPackages}</td>
                    {stores.map((s) => {
                      const cell = row.byStore[s.storeId]
                      return (
                        <td key={s.storeId} className="num">
                          {cell && cell.status === 'priced' ? formatCents(cell.lineTotalCents) : <span className="pill warn">No price</span>}
                        </td>
                      )
                    })}
                    <td>{row.cheapestStoreIds.map(storeName).join(', ') || 'Nowhere yet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption">
            Prices as recorded on or before {new Date(clockIso).toLocaleDateString('en-US')}. A price recorded after
            that date is never used. {dataMode === 'demo' ? 'Every price in this table is made up test data.' : 'These are prices you recorded yourself.'}
          </p>

          <div className="row">
            <button type="button" onClick={exportCsv}>
              <Download size={16} aria-hidden="true" /> Download this comparison as a spreadsheet
            </button>
            <Link className="btn" to="/plan"><Route size={16} aria-hidden="true" /> Turn it into a shopping list</Link>
          </div>
        </div>
      </details>

      {baseline === null && bestSplit !== null ? (
        <Banner tone="demo">
          No single store carries this whole basket, so there is nothing complete to measure savings against. The two
          store plan works, but CartNomic will not publish a savings number against a plan that does not exist.
        </Banner>
      ) : null}

      <div className="cta-bar no-print">
        <span className="small muted">Happy with the recommendation?</span>
        <Link className="btn primary" to="/plan">Build my shopping list <Route size={16} aria-hidden="true" /></Link>
      </div>
    </>
  )
}
