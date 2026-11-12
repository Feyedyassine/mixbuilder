import type { ReactNode } from 'react'

// Starter Privacy Policy + Terms tailored to mixbuilder's model (client-side
// analysis, no accounts, everything stored in the browser). NOT legal advice — review
// and fill the bracketed fields (contact email, governing law, entity) before
// relying on these.

const UPDATED = '12 November 2026'
const CONTACT = 'hello@mixbuilder.io'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 sm:p-8">
      <a href="#/" className="text-sm text-signal-500 hover:text-signal-400">
        ← Back to mixbuilder
      </a>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-100">{title}</h1>
      <p className="mt-1 text-xs text-neutral-500">Last updated: {UPDATED}</p>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-neutral-300">{children}</div>
    </div>
  )
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium text-neutral-100">{heading}</h2>
      {children}
    </section>
  )
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        mixbuilder helps DJs analyze their tracks and build sets. This policy explains what we
        collect and how we use it. mixbuilder is designed to keep your music on your device.
      </p>

      <Section heading="Your audio stays on your device">
        <p>
          mixbuilder analyzes your tracks entirely in your web browser. Your audio files, their
          embedded cover art, the analysis of your tracks and the sets you save never leave your
          device — mixbuilder has no accounts and no server-side database.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>
          Only anonymous usage data, through Google Analytics (see below). This includes how the app
          is used — for example how many tracks were added, which energy arc was picked and which
          export format was chosen — but never track titles, file names or audio.
        </p>
      </Section>

      <Section heading="What we do not collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your audio files — they are never uploaded.</li>
          <li>Cover art — it is read from your files on your device only.</li>
          <li>Track titles, artists, file names or the analysis of your tracks.</li>
          <li>Your saved sets or BPM/key corrections.</li>
          <li>Your name or email address — there are no accounts.</li>
        </ul>
      </Section>

      <Section heading="Storage in your browser">
        <p>
          mixbuilder stores analysis results, saved sets and your BPM/key corrections locally in
          your browser (IndexedDB), so they load quickly and work offline. They stay in that browser
          on that device; clearing this site&apos;s data in your browser settings deletes them, and
          we cannot recover them.
        </p>
      </Section>

      <Section heading="Analytics &amp; cookies">
        <p>
          We use Google Analytics to understand how the app is used — pages visited, device and
          browser type, and approximate location. This is standard web-usage data; it never includes
          your audio, the analysis of your tracks, or the contents of your sets. Google Analytics
          sets cookies, which you can block in your browser without affecting your ability to use
          mixbuilder.
        </p>
      </Section>

      <Section heading="Service providers">
        <p>
          We use Google Analytics for usage measurement and a hosting provider to serve the app.
          These providers process data on our behalf.
        </p>
      </Section>

      <Section heading="Your choices and rights">
        <p>
          You can delete everything mixbuilder stores by clearing this site&apos;s data in your
          browser. You can block Google Analytics — with your browser&apos;s privacy settings, an
          extension, or{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noreferrer"
            className="text-signal-500 hover:text-signal-400"
          >
            Google&apos;s opt-out add-on
          </a>{' '}
          — without affecting the app.
        </p>
        <p>
          If you are in the EU, the UK or a country with similar laws, you have the right to access,
          correct or delete personal data about you, to restrict or object to its processing, and to
          lodge a complaint with your local data protection authority. Because mixbuilder has no
          accounts and keeps nothing about you on its own servers, the only personal data involved
          is the usage data collected by Google Analytics, which is not linked to your name or
          email. To exercise these rights, contact us at the address below.
        </p>
        <p>
          If you are in California, you have the right to know what personal information is
          collected about you, to request its deletion, and not to be discriminated against for
          exercising these rights. We do not sell your personal information.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy? Email us at{' '}
          <a href={`mailto:${CONTACT}`} className="text-signal-500 hover:text-signal-400">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  )
}

export function Terms() {
  return (
    <LegalLayout title="Terms &amp; Conditions">
      <p>By using mixbuilder (the &ldquo;service&rdquo;) you agree to these terms.</p>

      <Section heading="The service">
        <p>
          mixbuilder analyzes audio tracks in your browser and helps you sequence them into DJ sets.
          Analysis runs on your device; we do not host or store your audio. Saved sets are kept in
          your browser, so they are not available on other devices and are lost if you clear your
          browser data.
        </p>
      </Section>

      <Section heading="Your content and rights">
        <p>
          You are responsible for the tracks you analyze, and you represent that you have the
          necessary rights to use them. mixbuilder does not store, host, or distribute your audio
          files.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use the service unlawfully, to infringe the rights of others, or to disrupt,
          overload, or attempt to compromise the service.
        </p>
      </Section>

      <Section heading="No warranty">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranties of any kind. We do not guarantee that analysis (such as tempo or key detection)
          is accurate, or that the service will be uninterrupted or error-free.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect, incidental, or
          consequential damages, or for any loss of data or sets, arising from your use of the
          service.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms from time to time. Continued use of the service after changes
          take effect means you accept the updated terms.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions? Email us at{' '}
          <a href={`mailto:${CONTACT}`} className="text-signal-500 hover:text-signal-400">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  )
}
