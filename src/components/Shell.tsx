import { BarChart3, ChevronRight, ClipboardList, Database, Scale, ShoppingCart, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../state/store'
import { LogoMark } from './Logo'
import { Banner } from './ui'

const NAV = [
  { to: '/basket', label: 'Basket', desc: 'Pick what you want to buy', Icon: ShoppingCart },
  { to: '/compare', label: 'Compare', desc: 'See if a second stop pays', Icon: Scale },
  { to: '/preferences', label: 'Preferences', desc: 'Your food rules and limits', Icon: SlidersHorizontal },
  { to: '/trends', label: 'Trends', desc: 'Real national price data', Icon: BarChart3 },
  { to: '/plan', label: 'Plan', desc: 'Your store by store list', Icon: ClipboardList },
]

const STEPS = [
  { to: '/basket', n: 1, label: 'Build your basket' },
  { to: '/compare', n: 2, label: 'Compare the stores' },
  { to: '/plan', n: 3, label: 'Shop the plan' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const { dataMode, setDataMode, storageRecovered, storageWritable, observations } = useApp()
  const { pathname } = useLocation()
  const stepIndex = STEPS.findIndex((s) => s.to === pathname)

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/basket" className="brand">
            <LogoMark size={30} variant="light" />
            <span className="brand-name">Cart<span style={{ color: '#A7F3D0' }}>Nomic</span></span>
          </NavLink>
          <span className="brand-tag">Is another stop worth it for the groceries you actually want?</span>
          <span className="topbar-spacer" />
          <div className="mode-switch" role="group" aria-label="Which prices to use">
            <button type="button" aria-pressed={dataMode === 'demo'} onClick={() => setDataMode('demo')}>
              Demo prices
            </button>
            <button type="button" aria-pressed={dataMode === 'verified'} onClick={() => setDataMode('verified')}>
              My own prices
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar" aria-label="Sections">
          <div className="sidenav">
            {NAV.map(({ to, label, desc, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon size={18} aria-hidden="true" />
                <span>
                  <span className="nav-label">{label}</span>
                  <span className="nav-desc">{desc}</span>
                </span>
              </NavLink>
            ))}
            <div className="sidenav-sep" />
            <NavLink to="/sources" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Database size={18} aria-hidden="true" />
              <span>
                <span className="nav-label">Sources and data</span>
                <span className="nav-desc">Where every number comes from</span>
              </span>
            </NavLink>
          </div>
        </nav>

        <main id="main" className="content">
          {stepIndex >= 0 ? (
            <nav className="steps no-print" aria-label="Main flow">
              {STEPS.map((step, index) => (
                <span key={step.to} style={{ display: 'contents' }}>
                  {index > 0 ? <ChevronRight size={15} className="step-arrow" aria-hidden="true" /> : null}
                  <NavLink
                    to={step.to}
                    className={'step' + (index === stepIndex ? ' current' : index < stepIndex ? ' done' : '')}
                    aria-current={index === stepIndex ? 'step' : undefined}
                  >
                    <span className="dot" aria-hidden="true">{step.n}</span>
                    {step.label}
                  </NavLink>
                </span>
              ))}
            </nav>
          ) : null}

          {storageRecovered ? (
            <Banner tone="danger">
              Saved data on this device could not be read, so CartNomic started a fresh basket. Nothing was uploaded anywhere.
            </Banner>
          ) : null}
          {!storageWritable ? (
            <Banner tone="demo">
              This browser is blocking local storage, so your basket will not survive a refresh. Everything else still works.
            </Banner>
          ) : null}

          {dataMode === 'demo' ? (
            <Banner tone="demo">
              <strong>You are in demo mode. </strong>
              The store prices below are made up test data, and the two stores are called Sample Store A and Sample
              Store B rather than real chains. The national inflation data on the Trends page is real and separately
              sourced.
            </Banner>
          ) : observations.length === 0 ? (
            <Banner tone="info">
              <strong>My own prices mode, and it is empty. </strong>
              This mode only ever shows prices you collected yourself. Add them on the Sources and data page, or switch
              back to demo prices to try the flow first.
            </Banner>
          ) : (
            <Banner tone="info">
              <strong>My own prices mode. </strong>
              {observations.length} price{observations.length === 1 ? '' : 's'} you recorded yourself. These never mix
              with the demo prices.
            </Banner>
          )}

          {children}

          <footer className="row between caption no-print" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <NavLink to="/sources">Sources, data coverage and import tools</NavLink>
            <span>A University of Arkansas SEVI 39303 class prototype. Not an official university product.</span>
          </footer>
        </main>
      </div>

      <nav className="bottomnav" aria-label="Sections">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
