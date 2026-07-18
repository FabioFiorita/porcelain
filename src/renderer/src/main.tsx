import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isBrowser, isLinuxShell } from './lib/platform'

// No macOS vibrancy behind the window on the browser client OR the Linux Electron shell;
// main.css paints the opaque void fallback on this class. (A design reset will make opaque
// the default later — for now Linux borrows the browser surface.)
if (isBrowser || isLinuxShell) document.documentElement.classList.add('browser')

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
