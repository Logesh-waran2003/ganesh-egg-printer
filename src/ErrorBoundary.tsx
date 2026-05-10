import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ margin: '12px 0', color: '#666' }}>The app crashed. Tap below to restart.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem' }}
          >
            Restart App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
