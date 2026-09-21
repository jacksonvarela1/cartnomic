import { useState } from 'react'
import { BadgeCheck, Download, FlaskConical, PenLine, Trash2, Upload } from 'lucide-react'
import { useApp } from '../state/store'
import cpiJson from '../data/bls_cpi_monthly.json'
import { coverageStats, type CpiSnapshot } from '../domain/cpi'
import { evidenceLibrary, usdaLimitations, usdaQuery, usdaRetrievedOn, DEMO_WARNING } from '../domain/catalog'
import { previewObservations, previewProducts, previewStores, toCsv, type ImportPreview } from '../domain/importer'
import { Banner, PageIntro, downloadText } from '../components/ui'
import type { PriceObservation, Product, Store } from '../domain/types'

const snapshot = cpiJson as unknown as CpiSnapshot
const stats = coverageStats(snapshot)

type Kind = 'stores' | 'products' | 'observations'

const TEMPLATES: Record<Kind, string> = {
  stores: 'store_id,retailer_name,location_name,address,city,state,postal_code,source_url,verified_at,notes',
  products: 'product_id,name,brand,gtin_upc,package_amount,package_unit,package_count,category,nutrition_record_id,label_source_url,label_verified_at,notes',
  observations: 'observation_id,product_id,store_id,observed_at,source_url,source_type,channel,currency,regular_price_cents,sale_price_cents,sale_starts_at,sale_ends_at,member_required,coupon_required,minimum_units,stock_status,verification_status,reviewer_id,notes',
}

export default function SourcesPage() {
  const { state, addImported, resetAll, observations, products, stores } = useApp()
  const [kind, setKind] = useState<Kind>('observations')
  const [preview, setPreview] = useState<ImportPreview<PriceObservation | Product | Store> | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    if (kind === 'observations') setPreview(previewObservations(text, state.userObservations) as ImportPreview<PriceObservation>)
    else if (kind === 'products') setPreview(previewProducts(text, state.userProducts) as ImportPreview<Product>)
    else setPreview(previewStores(text, state.userStores) as ImportPreview<Store>)
  }

  function commit() {
    if (!preview || preview.accepted.length === 0) return
    if (preview.kind === 'observations') addImported({ observations: preview.accepted as PriceObservation[] })
    else if (preview.kind === 'products') addImported({ products: preview.accepted as Product[] })
    else addImported({ stores: preview.accepted as Store[] })
    setPreview(null)
  }

  function exportEverything() {
    const rows = state.userObservations.map((o) => ({
      observation_id: o.observationId, product_id: o.productId, store_id: o.storeId, observed_at: o.observedAt,
      currency: o.currency, regular_price_cents: o.priceCents ?? '', sale_price_cents: o.salePriceCents ?? '',
      member_required: o.memberRequired, coupon_required: o.couponRequired, stock_status: o.stockStatus,
      review_status: o.reviewStatus, source_kind: o.sourceKind, source_url: o.sourceUrl ?? '', notes: o.notes ?? '',
    }))
    downloadText('cartnomic-my-observations.csv', rows.length === 0 ? TEMPLATES.observations : toCsv(rows))
  }

  return (
    <>
      <PageIntro
        eyebrow="Transparency"
        title="Where every number comes from."
        lead="Three kinds of data live in this app and they are kept strictly apart: official public data, prices you recorded yourself, and made up test data. Nothing is ever promoted from one category to another."
        points={[
          { icon: BadgeCheck, title: 'Public data', text: 'Government and manufacturer sources, with links and the date each one was retrieved.' },
          { icon: PenLine, title: 'Your own records', text: 'Anything you import, labeled unreviewed until a person actually checks it.' },
          { icon: FlaskConical, title: 'Test data', text: 'The fictional sample stores, labeled everywhere they appear, including exports.' },
        ]}
      />

      <div className="card">
        <div className="card-head">
          <h2>Real public data in this build</h2>
          <span className="pill good">Public observation</span>
        </div>

        <div className="src-block">
          <strong>Consumer Price Index, seven food at home series</strong>
          <p className="small">
            {stats.seriesCount} series, {stats.periodsPerSeries} monthly slots each ({stats.totalSlots} in total),
            {' '}{stats.numericValues} values and {stats.missingValues} explicitly missing. Coverage{' '}
            {snapshot.coverage_start} through {snapshot.coverage_end}. U.S. city average, CPI-U, not seasonally
            adjusted, index 1982-84=100.
          </p>
          <p className="caption">
            Producer: U.S. Bureau of Labor Statistics. Distributor: Federal Reserve Bank of St. Louis, FRED. Retrieved{' '}
            {snapshot.retrieved_on}. {snapshot.missing_policy}
          </p>
          <code>https://www.bls.gov/news.release/cpi.t01.htm</code>
          <code>https://fred.stlouisfed.org/data/CUUR0000SAF11</code>
        </div>

        <div className="src-block">
          <strong>USDA FoodData Central branded records</strong>
          <p className="small">
            Three selected historical branded records from a real API result for the query "{usdaQuery}". Retrieved{' '}
            {usdaRetrievedOn}. Nutrient values are per 100 g in this source, not per labeled serving.
          </p>
          <ul className="caption" style={{ margin: 0, paddingLeft: 18 }}>
            {usdaLimitations.map((limit) => <li key={limit}>{limit}</li>)}
          </ul>
          <code>https://fdc.nal.usda.gov/api-guide/</code>
        </div>

        <div className="src-block">
          <strong>Manufacturer label examples</strong>
          <p className="small">
            Two official manufacturer label transcriptions, used for ingredients and per serving nutrition only. They
            are not store quotes and carry no verified local price or UPC.
          </p>
          <ul className="caption" style={{ margin: 0, paddingLeft: 18 }}>
            {evidenceLibrary.filter((e) => e.sourceKind === 'manufacturer_label').map((e) => (
              <li key={e.recordId}>{e.displayName} - retrieved {e.retrievedOn} - <code>{e.sourceUrl}</code></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Fictional test data</h2>
          <span className="pill warn">Synthetic demo</span>
        </div>
        <p className="small">{DEMO_WARNING}</p>
        <p className="caption">
          Demo mode holds {products.filter((p) => p.dataMode === 'demo').length} products,{' '}
          {stores.filter((s) => s.dataMode === 'demo').length} sample stores and{' '}
          {observations.filter((o) => o.dataMode === 'demo').length} price observations. The stores are called Sample
          Store A and Sample Store B on purpose. They are not Walmart, Aldi, Harps or any other real retailer, and no
          verified Fayetteville price observation exists in this build.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Import your own observations</h2>
          <span className="pill neutral">User observation</span>
        </div>
        <p className="section-note">
          <strong>Collect five real prices at two stores and this stops being a demo.</strong> Import stores first,
          then products, then prices. Every upload gets a preview with row by row errors before anything is saved,
          and nothing you upload is ever marked as independently verified.
        </p>

        <div className="grid cols-3">
          <div className="field">
            <label htmlFor="kind">What are you importing</label>
            <select id="kind" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setPreview(null) }}>
              <option value="stores">Store locations</option>
              <option value="products">Products</option>
              <option value="observations">Price observations</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="file">CSV file</label>
            <input id="file" type="file" accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
          </div>
          <div className="field">
            <label htmlFor="tpl">Template</label>
            <button id="tpl" type="button" onClick={() => downloadText('cartnomic-' + kind + '-template.csv', TEMPLATES[kind])}>
              <Download size={16} aria-hidden="true" /> Download the header row
            </button>
          </div>
        </div>

        {preview ? (
          <div className="stack">
            {preview.fatalError ? (
              <Banner tone="danger">{preview.fatalError} Your existing data was left untouched.</Banner>
            ) : (
              <>
                <Banner tone={preview.errors.length > 0 ? 'demo' : 'info'}>
                  {preview.totalRows} row{preview.totalRows === 1 ? '' : 's'} read. {preview.accepted.length} ready to add,{' '}
                  {preview.errors.length} row error{preview.errors.length === 1 ? '' : 's'},{' '}
                  {preview.duplicatesInFile} duplicate{preview.duplicatesInFile === 1 ? '' : 's'} inside the file and{' '}
                  {preview.duplicatesAgainstExisting} already stored. Nothing is saved until you confirm.
                </Banner>
                {preview.errors.length > 0 ? (
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th scope="col">Row</th><th scope="col">Field</th><th scope="col">Problem</th></tr></thead>
                      <tbody>
                        {preview.errors.slice(0, 25).map((err, i) => (
                          <tr key={err.rowNumber + err.field + i}>
                            <td className="num">{err.rowNumber}</td>
                            <td>{err.field}</td>
                            <td>{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="row">
                  <button type="button" className="primary" disabled={preview.accepted.length === 0} onClick={commit}>
                    <Upload size={16} aria-hidden="true" /> Add {preview.accepted.length} row{preview.accepted.length === 1 ? '' : 's'}
                  </button>
                  <button type="button" onClick={() => setPreview(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <p className="caption">
          Observations are append only. A new row never overwrites a past observation, so a price history keeps its
          older entries.
        </p>
      </div>

      <div className="card">
        <h2>Your data on this device</h2>
        <p className="small muted">
          Everything lives in this browser. No account, no server, no upload. Raw research documents and classroom
          material are deliberately not part of this app.
        </p>
        <div className="row">
          <button type="button" onClick={exportEverything}>
            <Download size={16} aria-hidden="true" /> Export my observations as CSV
          </button>
          {confirmReset ? (
            <>
              <span className="small" role="alert">This clears your basket, preferences and imports on this device. This cannot be undone.</span>
              <button type="button" className="danger" onClick={() => { resetAll(); setConfirmReset(false) }}>
                <Trash2 size={16} aria-hidden="true" /> Yes, clear everything
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmReset(true)}>
              <Trash2 size={16} aria-hidden="true" /> Clear my saved data
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>What this build does not claim</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>No verified Fayetteville store prices have been collected, so no local savings figure is claimed.</li>
          <li>National CPI is national category inflation. It is not a retailer's markup or a local product price.</li>
          <li>Two interview responses are documented in the team notes. No further interviews are recorded here.</li>
          <li>Dietary rules are shopping filters. They are not medical advice, and they are not an allergy guarantee.</li>
          <li>Nutrition records carry old source dates and do not prove current labels, certifications or stock.</li>
        </ul>
      </div>
    </>
  )
}
