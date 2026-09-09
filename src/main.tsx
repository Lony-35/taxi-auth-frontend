import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider, createAuthClient, MockAuthClient } from './auth'
import './styles.css'

const useMock = import.meta.env.VITE_USE_MOCK_AUTH !== 'false'
const apiUrl = import.meta.env.VITE_AUTH_API_URL?.trim() ?? ''

if (!useMock && !apiUrl) {
  throw new Error('Для реального режима задайте VITE_AUTH_API_URL')
}

const client = useMock
  ? new MockAuthClient()
  : createAuthClient({ baseUrl: apiUrl })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={client}>
      <App useMock={useMock} />
    </AuthProvider>
  </StrictMode>,
)
