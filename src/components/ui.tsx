import { AlertTriangle, CheckCircle2, CircleHelp, Info, Inbox, XCircle, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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

/** A small question mark that explains a term in place. Every piece of jargon in the app has one. */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-btn"
        aria-expanded={open}
        aria-label={open ? 'Hide the explanation of ' + term : 'What does ' + term + ' mean?'}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open ? <span className="infotip-body" role="note">{children}</span> : null}
    </span>
  )
}

export interface IntroPoint {
  icon: LucideIcon
  title: string
  text: string
}

/** Every page opens the same way: where you are, what this screen is for, what you do and get. */
export function PageIntro({
  eyebrow, title, lead, points,
}: { eyebrow: string; title: string; lead: string; points?: IntroPoint[] }) {
  return (
    <div className="page-head">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="sub">{lead}</p>
      {points && points.length > 0 ? (
        <div className="intro-points">
          {points.map((point) => (
            <div key={point.title} className="intro-point">
              <span className="ip-icon"><point.icon size={17} aria-hidden="true" /></span>
              <span>
                <span className="ip-title">{point.title}</span>
                <span className="ip-text" style={{ display: 'block' }}>{point.text}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
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
      <summary>{summary ?? 'Why this verdict?'}</summary>
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

export function EmptyState({ title, icon: Icon = Inbox, children }: { title: string; icon?: LucideIcon; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={22} aria-hidden="true" /></span>
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
