import { AlertTriangle, CheckCircle2, CircleHelp, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DietAssessment, DietStatus } from '../domain/diet'
import { STATUS_LABEL } from '../domain/diet'

export function Banner({ tone, children }: { tone: 'demo' | 'info' | 'danger' | 'good'; children: ReactNode }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'demo' ? AlertTriangle : tone === 'good' ? CheckCircle2 : Info
  return (
    <div className={'banner ' + tone} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function StatusPill({ status }: { status: DietStatus }) {
  const tone = status === 'match' ? 'good' : status === 'does_not_match' ? 'bad' : 'warn'
  const Icon = status === 'match' ? CheckCircle2 : status === 'does_not_match' ? XCircle : CircleHelp
  return (
    <span className={'pill ' + tone}>
      <Icon size={13} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Never red or green alone: each state also carries a word and an icon. */
export function WhyPanel({ assessment, summary }: { assessment: DietAssessment; summary?: string }) {
  return (
    <details>
      <summary>{summary ?? 'Why?'}</summary>
      <div className="details-body">
        {assessment.preferenceGuideNote ? <Banner tone="info">{assessment.preferenceGuideNote}</Banner> : null}
        {assessment.rules.length === 0 ? (
          <p className="small muted">No dietary rules are switched on, so nothing was checked for this product.</p>
        ) : (
          <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {assessment.rules.map((rule) => (
              <li key={rule.ruleId} className="small">
                <strong>{rule.ruleLabel}: </strong>
                <StatusPill status={rule.status} /> <span className="muted">{rule.reason}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="caption stack" style={{ margin: 0 }}>
          <div className="row"><dt style={{ minWidth: 110 }}>Source</dt><dd style={{ margin: 0 }}>{assessment.sourceLabel}</dd></div>
          {assessment.sourceUrl ? (
            <div className="row"><dt style={{ minWidth: 110 }}>Source link</dt>
              <dd style={{ margin: 0 }}><a href={assessment.sourceUrl} target="_blank" rel="noreferrer noopener">{assessment.sourceUrl}</a></dd></div>
          ) : null}
          {assessment.sourceDate ? (
            <div className="row"><dt style={{ minWidth: 110 }}>Source date</dt><dd style={{ margin: 0 }}>{assessment.sourceDate}</dd></div>
          ) : null}
          <div className="row"><dt style={{ minWidth: 110 }}>Rule version</dt><dd style={{ margin: 0 }}>{assessment.ruleVersion}</dd></div>
          <div className="row"><dt style={{ minWidth: 110 }}>Evaluated</dt><dd style={{ margin: 0 }}>{assessment.evaluatedAt}</dd></div>
          {assessment.unresolvedFields.length > 0 ? (
            <div className="row"><dt style={{ minWidth: 110 }}>Unresolved</dt><dd style={{ margin: 0 }}>{assessment.unresolvedFields.join(' ')}</dd></div>
          ) : null}
        </dl>
        <Banner tone="info">{assessment.safetyNote}</Banner>
      </div>
    </details>
  )
}

export function Field({
  label, hint, error, children, id,
}: { label: string; hint?: string; error?: string | null; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="caption">{hint}</span> : null}
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  )
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
