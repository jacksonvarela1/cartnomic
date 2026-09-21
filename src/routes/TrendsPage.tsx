import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import cpiJson from '../data/bls_cpi_monthly.json'
import { useApp } from '../state/store'
import {
  buildSeriesViews, coverageStats, latestObservedPeriod, periodLabel, shiftPeriod, shortPeriodLabel, yearOverYear,
  type CpiSnapshot,
} from '../domain/cpi'
import { formatCents } from '../domain/money'
import { EmptyState, Banner, InfoTip, PageIntro } from '../components/ui'
import { Landmark, PackageSearch, Store } from 'lucide-react'

const snapshot = cpiJson as unknown as CpiSnapshot
const views = buildSeriesViews(snapshot)
const stats = coverageStats(snapshot)
const seriesList = snapshot.series

type Tab = 'national' | 'observed' | 'basket'

export default function TrendsPage() {
  const { observations, productsById, lines, stores, dataMode } = useApp()
  const [tab, setTab] = useState<Tab>('national')
  const [seriesId, setSeriesId] = useState('CUUR0000SAF11')
  const view = views.get(seriesId)!
  const latest = latestObservedPeriod(view)!
  const [from, setFrom] = useState(view.periods[0])
  const [to, setTo] = useState(latest)

  const lineData = useMemo(
    () =>
      view.periods
        .filter((p) => p >= from && p <= to)
        .map((period) => ({
          period,
          label: shortPeriodLabel(period),
          index: view.byPeriod.get(period) ?? null,
        })),
    [view, from, to],
  )

  const categoryData = useMemo(
    () =>
      seriesList.map((meta) => {
        const change = yearOverYear(views.get(meta.series_id)!, latest)
        return { label: meta.label, value: change.value, reason: change.unavailableReason }
      }),
    [latest],
  )

  const [productId, setProductId] = useState<string>('')
  const [storeId, setStoreId] = useState<string>('')
  const retailerRows = useMemo(
    () =>
      observations
        .filter((o) => o.productId === productId && o.storeId === storeId && o.priceCents !== null)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
    [observations, productId, storeId],
  )

  const basketDates = useMemo(() => {
    const dates = new Set<string>()
    for (const o of observations) if (o.priceCents !== null) dates.add(o.observedAt.slice(0, 10))
    return [...dates].sort()
  }, [observations])

  return (
    <>
      <PageIntro
        eyebrow="Context"
        title="What is actually happening to grocery prices?"
        lead="Real published data from the U.S. Bureau of Labor Statistics, plus any prices you have recorded yourself. The three tabs below are three different things, and CartNomic never mixes them."
        points={[
          { icon: Landmark, title: 'National food prices', text: 'Official government inflation data, recalculated here from the raw published numbers.' },
          { icon: Store, title: 'Observed store prices', text: 'Only prices you recorded yourself, at one store, for one exact product.' },
          { icon: PackageSearch, title: 'My fixed basket', text: 'What your own basket would have cost on different dates, with the list held still.' },
        ]}
      />

      <div className="tabs" role="tablist" aria-label="Trend sources">
        <button role="tab" aria-selected={tab === 'national'} onClick={() => setTab('national')}>National food prices</button>
        <button role="tab" aria-selected={tab === 'observed'} onClick={() => setTab('observed')}>Observed store prices</button>
        <button role="tab" aria-selected={tab === 'basket'} onClick={() => setTab('basket')}>My fixed basket</button>
      </div>

      {tab === 'national' ? (
        <>
          <div className="card">
            <div className="card-head">
              <h2>{view.meta.label} index</h2>
              <span className="pill good">Real public data</span>
            </div>
            <div className="section-note">
              <strong>How to read this.</strong> An index is not a dollar price. It tracks how far prices have moved
              from a base period, so a line going from 305 to 321 means prices rose about five percent over that
              stretch, not that anything costs $321. It is a national average, so it is not any one store setting its
              own prices.
              <InfoTip term="CPI-U, not seasonally adjusted">
                CPI-U is the index covering all urban consumers, the standard headline measure. Not seasonally
                adjusted means these are the raw monthly numbers, without smoothing out predictable seasonal swings.
              </InfoTip>
              <span className="caption" style={{ display: 'block', marginTop: 6 }}>
                U.S. city average, CPI-U, not seasonally adjusted. Data runs through {periodLabel(latest)}.
              </span>
            </div>

            <div className="grid cols-3">
              <div className="field">
                <label htmlFor="series">Series</label>
                <select id="series" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                  {seriesList.map((s) => <option key={s.series_id} value={s.series_id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="from">From</label>
                <select id="from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {view.periods.filter((p) => p <= to).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="to">To</label>
                <select id="to" value={to} onChange={(e) => setTo(e.target.value)}>
                  {view.periods.filter((p) => p >= from && p <= latest).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                </select>
              </div>
            </div>

            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#e6ece8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#52635B' }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#52635B' }} width={56}
                    label={{ value: 'Index 1982-84=100', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#52635B' } }} />
                  <Tooltip
                    formatter={(value) => {
                      const numeric = typeof value === 'number' ? value : null
                      return [numeric === null ? 'Not available in the source' : numeric.toFixed(3), view.meta.label]
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  {/* connectNulls is off so a missing month renders as a gap instead of a straight line. */}
                  <Line type="monotone" dataKey="index" stroke="#146C43" strokeWidth={2} dot={false} connectNulls={false} name={view.meta.label} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Banner tone="demo">
              {stats.missingValues} monthly values are missing in this snapshot, all in {stats.missingPeriods.map(periodLabel).join(', ')}.
              They are preserved as gaps. CartNomic does not fill them in and does not state a cause it has not verified.
            </Banner>

            <details>
              <summary>Read this chart as a table</summary>
              <div className="details-body">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th scope="col">Month</th><th scope="col" className="num">Index</th><th scope="col" className="num">Change from a year earlier</th></tr>
                    </thead>
                    <tbody>
                      {lineData.map((row) => {
                        const change = yearOverYear(view, row.period)
                        return (
                          <tr key={row.period}>
                            <th scope="row" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, background: 'transparent', position: 'static' }}>
                              {periodLabel(row.period)}
                            </th>
                            <td className="num">{row.index === null ? 'Not available' : row.index.toFixed(3)}</td>
                            <td className="num">{change.value === null ? 'Not available' : change.value.toFixed(1) + '%'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>

            <p className="caption">
              Producer: {view.meta.producer}. Distributor: {view.meta.distributor}. Retrieved {view.meta.retrieved_on}.{' '}
              <a href={view.meta.source_url} target="_blank" rel="noreferrer noopener">Series page</a>{' | '}
              <a href={view.meta.original_release_url} target="_blank" rel="noreferrer noopener">Original BLS release</a>
            </p>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Change from a year earlier by category</h2>
              <span className="pill good">Real public data</span>
            </div>
            <p className="small muted">
              Percent change, {periodLabel(latest)} against {periodLabel(shiftPeriod(latest, -12))},
              same calendar month. Negative values point down and carry a minus sign, not colour alone.
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="#e6ece8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#52635B' }} unit="%" />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11, fill: '#52635B' }} />
                  <Tooltip
                    formatter={(value) => {
                      const numeric = typeof value === 'number' ? value : null
                      return [numeric === null ? 'Not available' : numeric.toFixed(1) + '%', 'Change from a year earlier']
                    }}
                  />
                  <ReferenceLine x={0} stroke="#0B1F1A" />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.label} fill={(entry.value ?? 0) < 0 ? '#7A4A00' : '#146C43'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Category</th><th scope="col" className="num">Change from a year earlier</th></tr></thead>
                <tbody>
                  {categoryData.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, background: 'transparent', position: 'static' }}>{row.label}</th>
                      <td className="num">{row.value === null ? row.reason : (row.value > 0 ? '+' : '') + row.value.toFixed(1) + '%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="caption">
              Coverage: {stats.seriesCount} series, {stats.periodsPerSeries} months each, {stats.numericValues} values
              and {stats.missingValues} explicitly missing. Source: U.S. Bureau of Labor Statistics, CPI-U, distributed
              through FRED. This is national category inflation, not a local store price.
            </p>
          </div>
        </>
      ) : null}

      {tab === 'observed' ? (
        <div className="card">
          <div className="card-head">
            <h2>Observed store prices</h2>
            <span className="pill neutral">{dataMode === 'demo' ? 'Demo mode' : 'Your observations'}</span>
          </div>
          <p className="section-note">
            <strong>This tab stays empty until you collect data.</strong> A price history needs the same exact
            product, at the same store, recorded on at least two different dates. CartNomic will not stitch together
            different package sizes or locations, and it will never use national inflation to invent a store history.
          </p>
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="trend-product">Exact product</label>
              <select id="trend-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Choose a product</option>
                {Object.values(productsById).map((p) => <option key={p.productId} value={p.productId}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="trend-store">Store location</label>
              <select id="trend-store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Choose a store</option>
                {stores.map((s) => <option key={s.storeId} value={s.storeId}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {productId === '' || storeId === '' ? (
            <EmptyState title="Choose an exact product and one store location." />
          ) : retailerRows.length < 2 ? (
            <EmptyState title="Not enough comparable observations to show a price change.">
              <p className="small">
                {retailerRows.length} comparable observation{retailerRows.length === 1 ? '' : 's'} recorded. Different
                packages, channels or locations are not stitched together into one line, and CPI is never used to
                synthesize a retailer history.
              </p>
            </EmptyState>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Observed on</th><th scope="col" className="num">Price</th><th scope="col">Source</th></tr></thead>
                <tbody>
                  {retailerRows.map((o) => (
                    <tr key={o.observationId}>
                      <th scope="row" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, background: 'transparent', position: 'static' }}>
                        {new Date(o.observedAt).toLocaleDateString('en-US')}
                      </th>
                      <td className="num">{formatCents(o.priceCents)}</td>
                      <td>{o.sourceKind} ({o.reviewStatus})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'basket' ? (
        <div className="card">
          <h2>My fixed basket</h2>
          <p className="section-note">
            <strong>Same list, different dates.</strong> To compare what your basket cost over time, the list has to
            stay still. Adding an item or changing a quantity starts a new basket version, because spending more on
            more food is not the same thing as prices going up.
          </p>
          {lines.length === 0 ? (
            <EmptyState title="No basket yet." />
          ) : basketDates.length < 2 ? (
            <EmptyState title="Only one pricing date is available for this basket.">
              <p className="small">
                {basketDates.length === 0 ? 'No dated prices are recorded.' : 'Prices are all from ' + basketDates[0] + '.'}
                {' '}A basket cost history needs at least two dates with comparable coverage of the same {lines.length} item
                {lines.length === 1 ? '' : 's'}.
              </p>
            </EmptyState>
          ) : (
            <p className="small">
              {basketDates.length} pricing dates recorded. Coverage is checked per date before any endpoint comparison
              is shown.
            </p>
          )}
          <p className="caption">
            Basket version: {lines.length} lines, quantities {lines.map((l) => l.quantityPackages).join('/')}. Any edit
            starts a new version rather than bending the old line.
          </p>
        </div>
      ) : null}
    </>
  )
}
