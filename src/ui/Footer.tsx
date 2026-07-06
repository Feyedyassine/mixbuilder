export default function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-800/70 px-4 py-6 text-xs text-neutral-500">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-neutral-600">© 2026 mixbuilder</span>
        <a href="#/privacy" className="transition hover:text-neutral-300">
          Privacy
        </a>
        <a href="#/terms" className="transition hover:text-neutral-300">
          Terms
        </a>
      </div>
    </footer>
  )
}
