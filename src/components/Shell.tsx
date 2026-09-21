import { BarChart3, ClipboardList, Database, Scale, ShoppingCart, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useApp } from '../state/store'
import { LogoMark } from './Logo'
import { Banner } from './ui'

const NAV = [
  { to: '/basket', label: 'Basket', Icon: ShoppingCart },
  { to: '/compare', label: 'Compare', Icon: Scale },
  { to: '/preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { to: '/trends', label: 'Trends', Icon: BarChart3 },
  { to: '/plan', label: 'Plan', Icon: ClipboardList },
]

export default function Shell({ children }: { children: ReactNode }) {
  const { dataMode, setDataMode, storageRecovered, storageWritable, observations } = useApp()

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/basket" className="brand">
            <LogoMark size={30} variant="light" />
            <span>
              <span className="brand-name">Cart<span className="nomic">Nomic</span></span>
            </span>
          </NavLink>
          <span className="brand-tag">Know what your cart is worth.</span>
          <span className="topbar-spacer" />
          <div className="mode-switch" role="group" aria-label="Price data mode">
            <button type="button" aria-pressed={dataMode === 'demo'} onClick={() => setDataMode('demo')}>
              Demo prices
            </button>
            <button type="button" aria-pressed={dataMode === 'verified'} onClick={() => setDataMode('verified')}>
              Your verified observations
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar" aria-label="Sections">
          <div className="sidenav">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <NavLink to="/sources" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Database size={18} aria-hidden="true" />
              Sources and data
            </NavLink>
          </div>
        </nav>

        <main id="main" className="content">
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
              Demo shopping prices. Sample stores and savings are fictional. National inflation data is real and separately sourced.
            </Banner>
          ) : observations.length === 0 ? (
            <Banner tone="info">
              No verified store prices yet. Import observations on the Sources and data page, or switch back to the sample basket.
            </Banner>
          ) : (
            <Banner tone="info">
              Your verified observations mode. {observations.length} price observation{observations.length === 1 ? '' : 's'} you imported, kept separate from demo prices.
            </Banner>
          )}

          {children}

          <footer className="row between caption no-print" style={{ paddingTop: 8 }}>
            <NavLink to="/sources">Sources, data coverage and import tools</NavLink>
            <span>CartNomic is a University of Arkansas SEVI 39303 class prototype. Not an official university product.</span>
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
