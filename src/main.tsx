import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preloadTheme } from './lib/store'
import { registerServiceWorker } from './lib/pwa'

// Runs before the first paint so light-mode users never see a dark flash.
preloadTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// React has painted, so the inline splash has done its job. Fading it out
// (rather than removing it) keeps the launch from feeling like a hard cut.
let splashRemoved = false
function dismissSplash() {
  if (splashRemoved) return
  splashRemoved = true
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.dataset.hidden = 'true'
  window.setTimeout(() => splash.remove(), 260)
}

// Two frames line the swap up with the first real paint. The timeout is not
// redundant: requestAnimationFrame is paused entirely in a background tab, and
// the splash is a full-screen fixed overlay — if the app were backgrounded
// during startup it would sit on top and swallow every tap. This guarantees
// it always goes away.
requestAnimationFrame(() => requestAnimationFrame(dismissSplash))
window.setTimeout(dismissSplash, 600)

// Offline shell + installability. No-op outside production, and a failure here
// never affects the app.
registerServiceWorker()