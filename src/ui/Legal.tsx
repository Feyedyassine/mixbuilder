import type { ReactNode } from 'react'

// Starter Privacy Policy + Terms tailored to mixbuilder's model (client-side
// analysis, no audio stored, anonymous shared cache). NOT legal advice — review
// and fill the bracketed fields (contact email, governing law, entity) before
// relying on these.

const UPDATED = '6 July 2026'
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
          mixbuilder analyzes your tracks entirely in your web browser. Your audio files and their
          embedded cover art are never uploaded to or stored on our servers. Only the derived
          analysis — numeric features such as tempo, musical key, energy and section structure — is
          sent to us, and only when you are signed in.
        </p>
      </Section>

      <Section heading="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> the email address you sign in with, handled by our
            authentication provider.
          </li>
          <li>
            <strong>Derived track analysis:</strong> non-audio feature data (tempo, key, energy,
            structure) stored in a shared cache and keyed by an anonymous fingerprint of the audio.
            This data cannot be turned back into your audio.
          </li>
          <li>
            <strong>Track metadata:</strong> title, artist, genre and filename, used to power your
            library and aggregate catalogue statistics.
          </li>
          <li>
            <strong>Your sets:</strong> the sequenced sets you choose to save to your account.
          </li>
        </ul>
      </Section>

      <Section heading="What we do not collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your audio files — they are never uploaded.</li>
          <li>Cover art — it is read from your files on your device only.</li>
        </ul>
      </Section>

      <Section heading="The shared cache">
        <p>
          To make analysis fast for everyone, derived features are stored in a cache shared across
          users and keyed only by an anonymous audio fingerprint. These entries are not linked to
          your identity.
        </p>
      </Section>

      <Section heading="Storage in your browser">
        <p>
          mixbuilder stores analysis results locally in your browser (IndexedDB) so your library
          loads quickly and works offline. You can clear this at any time through your browser
          settings.
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
          We use Supabase for authentication and database storage, Google Analytics for usage
          measurement, and a hosting provider to serve the app. These providers process data on our
          behalf.
        </p>
      </Section>

      <Section heading="Your choices">
        <p>
          You can request deletion of your account and associated data by contacting us. Depending
          on where you live, you may have additional rights over your data [add
          jurisdiction-specific rights, e.g. GDPR / CCPA].
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
          Analysis runs on your device; we do not host or store your audio.
        </p>
      </Section>

      <Section heading="Your content and rights">
        <p>
          You are responsible for the tracks you analyze, and you represent that you have the
          necessary rights to use them. mixbuilder does not store, host, or distribute your audio
          files. By using the service while signed in, you grant us permission to store the derived,
          non-audio analysis of your tracks in our shared cache.
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

      <Section heading="Accounts">
        <p>
          You are responsible for activity under your account. We may suspend or terminate accounts
          that violate these terms.
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
