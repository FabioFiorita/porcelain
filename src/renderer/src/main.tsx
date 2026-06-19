import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

// Tag <html> with the effective platform before first paint so platform-scoped CSS
// (e.g. the opaque Linux void) applies without a flash. macOS keeps the vibrancy void.
const platform = window.porcelain?.platform ?? 'darwin'
document.documentElement.classList.add(`platform-${platform}`)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
