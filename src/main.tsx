import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/chivo'
import '@fontsource-variable/chivo-mono'
import App from '@/ui/App'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
