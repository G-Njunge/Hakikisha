import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import BackendWakeGate from './components/BackendWakeGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Gates AuthProvider itself, not just App — AuthProvider fires its own
          /me request on mount, which would otherwise hang against a sleeping
          Render backend at the same time this is polling /health. */}
      <BackendWakeGate>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BackendWakeGate>
    </BrowserRouter>
  </StrictMode>,
)
