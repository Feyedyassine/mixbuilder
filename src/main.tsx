import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/chivo'
import '@fontsource-variable/chivo-mono'
import App from '@/ui/App'
import { initAnalytics } from '@/lib/analytics'
import '@/index.css'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
