import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/**
 * A lazily loaded route can fail to fetch, usually because the site was redeployed while this tab
 * was open and the old chunk filename no longer exists. Without this the user just gets a blank
 * page, so show them the one action that actually fixes it.
 */
export default class ChunkBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('CartNomic could not load part of the app.', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="empty">
        <strong>This section could not load.</strong>
        <p>
          That usually means the app was updated while this tab was open. Reloading fixes it, and
          nothing you have entered is lost.
        </p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    )
  }
}
