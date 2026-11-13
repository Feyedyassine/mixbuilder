import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/chivo'
import '@fontsource-variable/chivo-mono'
import App from '@/ui/App'
import { initAnalytics } from '@/lib/analytics'
import { reportCapabilitiesOnce } from '@/lib/capabilities'
import '@/index.css'

initAnalytics()
// Off the critical path: probing the GPU adapter can take a moment.
setTimeout(() => void reportCapabilitiesOnce(), 3000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
