// Entry for the static /faq page: shared fonts + styles, and GA. No React — the
// page is plain HTML so crawlers and AI assistants can read it without running JS.
import '@fontsource-variable/chivo'
import '@fontsource-variable/chivo-mono'
import { initAnalytics } from '@/lib/analytics'
import '@/index.css'

initAnalytics()
