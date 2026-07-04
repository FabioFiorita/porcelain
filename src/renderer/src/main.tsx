import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isBrowser } from './lib/platform'

// Browser client has no vibrancy behind the window; main.css paints the void fallback on this class.
if (isBrowser) document.documentElement.classList.add('browser')

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
