import { Download, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/store'
import { formatCents, formatSignedCents, parseDollarsToCents } from '../domain/money'
import { toCsv } from '../domain/importer'
import { Banner, EmptyState, Field } from '../components/ui'
import { downloadText } from '../components/ui'
import type { Plan } from '../domain/compare'

function planTitle(plan: Plan, storeName: (id: string) => string): string {
  if (plan.candidateStoreIds.length === 1) return storeName(plan.candidateStoreIds[0]) + ' only'
  return 'Split: ' + plan.candidateStoreIds.map(storeName).join(' and ')
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
          : 'Your own imported observations. Not independently verified by CartNomic.',
        quantity_packages: '',
      },
    ]
    const columns = Object.keys(rows[0] ?? { line_id: '', product_id: '', product_name: '', quantity_packages: '' })
    downloadText('cartnomic-comparison.csv', toCsv([...rows, ...summary], columns))
  }

  if (lines.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1>Is another stop worth it?</h1>
        </div>
        <EmptyState title="Add at least one item.">
          <Link className="btn primary" to="/basket">Go to the basket</Link>
        </EmptyState>
      </>
    )
  }

  const netClass = (decision.netCashSavingsCents ?? 0) > 0 ? 'positive' : (decision.netCashSavingsCents ?? 0) < 0 ? 'negative' : ''

  return (
    <>
      <div className="page-head">
        <h1>Is another stop worth it?</h1>
        <p className="sub">
          Complete baskets only. A store missing a price cannot win by counting that item as zero.
        </p>
      </div>

      {comparison.conflicts.map((conflict) => <Banner key={conflict} tone="danger">{conflict}</Banner>)}

      <section className="decision" aria-label="Recommendation">
        <div className="row between">
          <h2>{decision.headline}</h2>
          <span className="pill ink">{dataMode === 'demo' ? 'Demo prices, fictional' : 'Your observations'}</span>
        </div>
        <p className="muted">{decision.detail}</p>

        {decision.kind === 'cannot_compare' || decision.kind === 'no_complete_baseline' ? null : (
          <div className="decision-grid">
            <div className="decision-figure">
              <span className="muted small">Net cash savings after the extra trip</span>
              <span className={'value ' + netClass}>{formatSignedCents(decision.netCashSavingsCents)}</span>
            </div>
            <div className="decision-figure">
              <span className="muted small">Grocery savings before trip cost</span>
              <span className="value">{formatSignedCents(decision.grossSavingsCents)}</span>
            </div>
            <div className="decision-figure">
              <span className="muted small">Your minimum to make a stop worth it</span>
              <span className="value">{formatCents(decision.thresholdCents)}</span>
            </div>
          </div>
        )}

        <div>
          {decision.baselineStoreId ? (
            <div className="decision-line">
              <span>Baseline: cheapest complete one store plan at {storeName(decision.baselineStoreId)}</span>
              <span className="num">{formatCents(decision.baselineCostCents)}</span>
            </div>
          ) : null}
          {decision.candidateCostCents !== null && decision.candidateStoreIds.length > 1 ? (
            <div className="decision-line">
              <span>Two store plan: {decision.candidateStoreIds.map(storeName).join(' and ')}</span>
              <span className="num">{formatCents(decision.candidateCostCents)}</span>
            </div>
          ) : null}
          {decision.tripCost.valid ? (
            <div className="decision-line">
              <span>Estimated extra trip cost, from your settings</span>
              <span className="num">{formatCents(decision.tripCost.extraCashTripCostCents)}</span>
            </div>
          ) : null}
          <div className="decision-line">
            <span>Extra time you entered</span>
            <span className="num">{decision.extraMinutes} minutes{decision.countsTimeValue ? ' (valued and subtracted)' : ' (shown separately, not subtracted)'}</span>
          </div>
          {decision.countsTimeValue && decision.netAfterTimeValueCents !== null ? (
            <div className="decision-line">
              <span>Net after your time valuation</span>
              <span className="num">{formatSignedCents(decision.netAfterTimeValueCents)}</span>
            </div>
          ) : null}
          {decision.savingsPercent !== null ? (
            <div className="decision-line">
              <span>Grocery savings against the named baseline</span>
              <span className="num">{decision.savingsPercent.toFixed(1)}%</span>
            </div>
          ) : null}
          <div className="decision-line">
            <span>Taxes</span>
            <span>Not included. Estimated savings may change at checkout.</span>
          </div>
        </div>
      </section>

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
                <span className="caption">{plan.complete ? 'Complete basket total' : 'Known item subtotal'}</span>
                <div className="total num">{formatCents(plan.complete ? plan.shoppingCostCents : plan.knownItemSubtotalCents)}</div>
              </div>
              {plan.complete ? (
                <span className="pill good">All {plan.lines.length} items priced</span>
              ) : (
                <span className="pill warn">
                  Missing prices for {plan.missingLineIds.length} item{plan.missingLineIds.length === 1 ? '' : 's'}
                </span>
              )}
              {plan.feesCents > 0 ? <span className="caption">Includes {formatCents(plan.feesCents)} of per trip store fees.</span> : null}
              {!plan.complete ? (
                <ul className="caption" style={{ margin: 0, paddingLeft: 18 }}>
                  {plan.lines.filter((l) => l.status !== 'priced').map((l) => (
                    <li key={l.lineId}>{l.reasons[0]}</li>
                  ))}
                </ul>
              ) : null}
              {plan.stops > 1 ? <span className="caption">This plan uses {plan.stops} stores.</span> : null}
            </section>
          )
        })}
      </div>

      <div className="card">
        <h2>Trip settings</h2>
        <p className="small muted">
          These are your own inputs and estimates, not geolocation or a routing service. Extra miles are the extra
          distance beyond your baseline trip.
        </p>
        <div className="grid cols-3">
          <Field label="Extra miles" id="miles" error={errors.extraMiles}>
            <input id="miles" type="number" min={0} step="0.1" value={trip.extraMiles}
              onChange={(e) => setTrip((t) => ({ ...t, extraMiles: Number(e.target.value) }))} />
          </Field>
          <Field label="Miles per gallon" id="mpg" error={errors.mpg}>
            <input id="mpg" type="number" min={0} step="0.1" value={trip.mpg}
              onChange={(e) => setTrip((t) => ({ ...t, mpg: Number(e.target.value) }))} />
          </Field>
          <Field label="Fuel price per gallon" id="fuel" error={errors.fuelPriceCentsPerGallon}
            hint={'Fuel cost from these inputs: ' + formatCents(decision.tripCost.fuelCents)}>
            <input id="fuel" inputMode="decimal" defaultValue={(trip.fuelPriceCentsPerGallon / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, fuelPriceCentsPerGallon: parsed.cents! }))
              }} />
          </Field>
          <Field label="Extra tolls or parking" id="tolls" error={errors.incrementalTollsCents}>
            <input id="tolls" inputMode="decimal" defaultValue={(trip.incrementalTollsCents / 100).toFixed(2)}
              onChange={(e) => {
                const parsed = parseDollarsToCents(e.target.value)
                if (parsed.cents !== null && !parsed.error) setTrip((t) => ({ ...t, incrementalTollsCents: parsed.cents! }))
              }} />
          </Field>
          <Field label="Extra minutes" id="minutes" error={errors.extraMinutes}>
            <input id="minutes" type="number" min={0} step="1" value={trip.extraMinutes}
              onChange={(e) => setTrip((t) => ({ ...t, extraMinutes: Number(e.target.value) }))} />
          </Field>
          <Field label="Minimum net savings to make the stop worth it" id="threshold" error={errors.minimumNetSavingsCents}>
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
            Also subtract a value for my time
            <span className="caption" style={{ display: 'block' }}>
              Off by default. Time is shown separately unless you switch this on.
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
            Net savings cannot be calculated until every highlighted trip input is valid. Nothing was guessed in the meantime.
          </Banner>
        ) : null}
      </div>

      <details>
        <summary>How we calculated this</summary>
        <div className="details-body">
          <div className="src-block">
            <p className="small"><code>shopping_cost(P) = merchandise(P) + eligible per store fees(P)</code></p>
            <p className="small"><code>gross_savings = shopping_cost(baseline) - shopping_cost(plan)</code></p>
            <p className="small"><code>fuel_cost = round_half_up((extra_miles / mpg) * fuel_price_per_gallon)</code></p>
            <p className="small"><code>net_cash_savings = gross_savings - extra_cash_trip_cost</code></p>
            <p className="caption">
              Money is held in integer cents and rounded half up only at line and fee boundaries. The baseline is the
              cheapest complete one store plan among the stores you selected, never the most expensive one.
            </p>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="num">Qty</th>
                  {stores.map((s) => <th key={s.storeId} scope="col" className="num">{s.name}</th>)}
                  <th scope="col">Cheapest</th>
                </tr>
              </thead>
              <tbody>
                {lineMatrix.map((row) => (
                  <tr key={row.lineId}>
                    <th scope="row" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, background: 'transparent', position: 'static' }}>
                      {row.productName}
                    </th>
                    <td className="num">{row.quantityPackages}</td>
                    {stores.map((s) => {
                      const cell = row.byStore[s.storeId]
                      return (
                        <td key={s.storeId} className="num">
                          {cell && cell.status === 'priced' ? formatCents(cell.lineTotalCents) : <span className="pill warn">No price</span>}
                        </td>
                      )
                    })}
                    <td>{row.cheapestStoreIds.map(storeName).join(', ') || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption">
            Observed on {new Date(clockIso).toLocaleDateString('en-US')} or earlier. Prices observed after the comparison
            date are never used. {dataMode === 'demo' ? 'Every price in this table is fictional demo data.' : 'These are your own unreviewed observations.'}
          </p>

          <div className="row">
            <button type="button" onClick={exportCsv}>
              <Download size={16} aria-hidden="true" /> Export this comparison as CSV
            </button>
            <Link className="btn" to="/plan"><Route size={16} aria-hidden="true" /> Open the shopping plan</Link>
          </div>
        </div>
      </details>

      {baseline === null && bestSplit !== null ? (
        <Banner tone="demo">
          No single store carries this whole basket, so there is no complete one store baseline. CartNomic will not
          publish a savings figure against a plan that does not exist.
        </Banner>
      ) : null}
    </>
  )
}
