import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

window.addEventListener('error', e => {
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) root.innerHTML = `<pre style="padding:24px;color:#f87171;font:12px system-ui;white-space:pre-wrap">${e.message}\n${e.filename ?? ''}:${e.lineno ?? ''}</pre>`
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
