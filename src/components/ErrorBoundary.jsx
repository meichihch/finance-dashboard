import { Component } from 'react'

// Shows the error instead of a blank page if anything throws while rendering.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error(error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', color: '#e4e4e7', background: '#0b0b10', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong</h1>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#f87171' }}>
          {String(this.state.error?.stack ?? this.state.error)}
        </pre>
        <button onClick={() => location.reload()} style={{ marginTop: 12, padding: '6px 12px' }}>Reload</button>
      </div>
    )
  }
}
