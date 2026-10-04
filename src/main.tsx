import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter.js'
import '@fontsource-variable/inter'
import './styles.css'
import { applyThemePreference } from './utils/theme.js'

// Apply the saved appearance before the first paint, including sign-in pages.
applyThemePreference()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
