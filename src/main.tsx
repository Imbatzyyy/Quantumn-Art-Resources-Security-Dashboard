import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.js'
import { HrmsProvider } from './state/HrmsContext.jsx'
import './styles.css'
import './workspace-redesign.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HrmsProvider>
        <App />
      </HrmsProvider>
    </BrowserRouter>
  </StrictMode>,
)
