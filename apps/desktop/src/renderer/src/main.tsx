import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyResolvedTheme, resolveTheme } from './lib/theme'
import { usePreferencesStore } from './stores/preferences'

// Correct the boot theme before first paint. index.html hardwires
// `class="dark"` as a dark flash-guard; zustand's persist hydrates
// synchronously from localStorage, so we can resolve the real preference here
// and flip the class/color-scheme before React mounts (no light-on-dark flash).
applyResolvedTheme(resolveTheme(usePreferencesStore.getState().theme))

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
