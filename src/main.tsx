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
  : createAuthClient({
      baseUrl: apiUrl,
      driverPhonePrefix: import.meta.env.VITE_DRIVER_PHONE_PREFIX?.trim() || undefined,
      defaultCountry: import.meta.env.VITE_DEFAULT_COUNTRY?.trim() || undefined,
      defaultLocationClassId: import.meta.env.VITE_DEFAULT_LOCATION_CLASS_ID?.trim() || undefined,
    })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={client}>
      <App useMock={useMock} />
    </AuthProvider>
  </StrictMode>,
)
