import Link from 'next/link'
import { Shield, Eye, EyeOff, BarChart3, Lightbulb, Lock, Database, Trash2 } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy - Aegis',
  description: 'How Aegis handles your data, what we collect, and why.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="text-2xl font-bold text-primary-600">
            Aegis
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-xl text-gray-600">
            We believe in complete transparency about data collection. Here&apos;s exactly what we collect, why, and how you benefit.
          </p>
          <p className="text-sm text-gray-500 mt-4">Last updated: August 2026</p>
        </div>

        {/* TL;DR */}
        <section className="bg-primary-50 rounded-xl p-6 mb-12">
          <h2 className="text-lg font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            TL;DR - The Short Version
          </h2>
          <ul className="space-y-2 text-primary-800">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 font-bold">1.</span>
              <span><strong>Self-hosted:</strong> only an anonymous liveness ping by default (a random ID + version — one click to turn it off). Everything else is opt-in.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 font-bold">2.</span>
              <span><strong>Hosted:</strong> We collect health metrics and anonymous usage stats.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 font-bold">3.</span>
              <span><strong>Never:</strong> We never collect your organization name, user data, or any PII.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 font-bold">4.</span>
              <span><strong>Purpose:</strong> Usage data helps us build features you actually need.</span>
            </li>
          </ul>
        </section>

        {/* What We Collect */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Eye className="h-6 w-6 text-primary-600" />
            What We Collect
          </h2>

          <div className="space-y-6">
            {/* Anonymous liveness — install ping (once) + alive ping (daily) */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Anonymous liveness ping</h3>
              <p className="text-gray-600 mb-4">
                On by default (one click to turn off). Sent once at install, then
                once a day, so active installs can be counted. A random instance ID
                and the version — nothing else, no usage, no PII.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <div className="text-gray-500">{`// install (once)`}</div>
                <div className="text-gray-800">{`{ "instance_id": "Aegis_abc123...", "version": "1.2.3",`}</div>
                <div className="text-gray-800 pl-4">{`"license_key": null, "installed_at": "2026-08-24T..." }`}</div>
                <div className="text-gray-500 mt-2">{`// daily liveness (recurring)`}</div>
                <div className="text-gray-800">{`{ "instance_id": "Aegis_abc123...", "version": "1.2.3" }`}</div>
              </div>
            </div>

            {/* Usage Metrics — opt-in */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Usage Metrics (opt-in)</h3>
              <p className="text-gray-600 mb-4">
                Off unless you turn it on. Anonymous ranges — never exact counts —
                of how Aegis is used. This directly shapes what we build next.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <div className="text-gray-500">{`// What we receive`}</div>
                <div className="text-gray-800">{`{`}</div>
                <div className="text-gray-800 pl-4">{`"user_count_range": "6-20",`}</div>
                <div className="text-gray-800 pl-4">{`"ticket_volume": { "total_range": "51-100", "open": 12 },`}</div>
                <div className="text-gray-800 pl-4">{`"modules_enabled": ["tickets", "kb", "assets"],`}</div>
                <div className="text-gray-800 pl-4">{`"uptime_hours": 720`}</div>
                <div className="text-gray-800">{`}`}</div>
              </div>
            </div>
          </div>
        </section>

        {/* What We Don't Collect */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <EyeOff className="h-6 w-6 text-primary-600" />
            What We Never Collect
          </h2>

          <div className="bg-red-50 rounded-lg p-6">
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Your organization name',
                'Your domain name',
                'User names or emails',
                'Email signature content',
                'Group memberships',
                'Org chart data',
                'Google Workspace credentials',
                'IP addresses (self-hosted)',
                'Any actual user data',
                'API request/response content',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-red-800">
                  <span className="text-red-600">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How This Helps You */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Lightbulb className="h-6 w-6 text-primary-600" />
            How This Data Helps You
          </h2>

          <p className="text-gray-600 mb-6">
            We use usage data to make better product decisions. Here&apos;s exactly how:
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">API Relay Usage</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                We track which Google Workspace APIs you call through the relay console.
              </p>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
                <strong>Result:</strong> If many users call <code className="bg-green-100 px-1 rounded">users.list</code> API directly,
                we build a proper Users UI for it in the next release.
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Command Usage</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                We track which admin commands you run and how often.
              </p>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
                <strong>Result:</strong> Popular commands become one-click buttons and keyboard shortcuts
                in the admin interface.
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Module Adoption</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                We track which modules are enabled across all instances.
              </p>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
                <strong>Result:</strong> We prioritize development and documentation
                for modules people actually use.
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Feature Discovery</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                We track which new features get used after release.
              </p>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
                <strong>Result:</strong> Features with low adoption get better docs,
                tutorials, or UI improvements.
              </div>
            </div>
          </div>
        </section>

        {/* Your Controls */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Lock className="h-6 w-6 text-primary-600" />
            Your Controls
          </h2>

          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Self-Hosted Instances</h3>
              <p className="text-gray-600 mb-4">
                Only the anonymous liveness ping is <strong>on by default</strong>
                (disclosed in the setup wizard, one click to turn off). Usage
                metrics are <strong>opt-in</strong>. You control all of it at
                <code className="text-gray-800"> /portal/settings/telemetry</code>,
                or kill everything with a container-level env var that overrides
                the in-app setting:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <div className="text-gray-500"># In your .env file — beats any in-app setting</div>
                <div className="text-gray-800">TELEMETRY_ENABLED=false</div>
              </div>
              <p className="text-gray-500 text-sm mt-3">
                Every consent state change is recorded in your install&apos;s
                <code className="text-gray-800"> telemetry_consent_log </code>
                table (append-only audit trail per PRINCIPLES.md #6).
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Hosted Instances</h3>
              <p className="text-gray-600 mb-4">
                Basic health telemetry is required for us to maintain your instance.
                You can control usage metrics in Settings &gt; Privacy.
              </p>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Database className="h-6 w-6 text-primary-600" />
            Data Retention
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">Data Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">Retention</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">After Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">Health heartbeats</td>
                  <td className="px-4 py-3 text-sm text-gray-600">90 days</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Deleted</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">Usage metrics</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Aggregated immediately</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Individual data removed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">Support conversations</td>
                  <td className="px-4 py-3 text-sm text-gray-600">2 years</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Archived (available on request)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">Error logs</td>
                  <td className="px-4 py-3 text-sm text-gray-600">30 days</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Deleted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Your Rights */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Trash2 className="h-6 w-6 text-primary-600" />
            Your Rights
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Export Your Data</h3>
              <p className="text-gray-600 text-sm mb-4">
                Request a copy of all data we have about your instance.
              </p>
              <a href="mailto:privacy@obilabs.dev?subject=Data Export Request"
                className="text-primary-600 hover:underline text-sm">
                privacy@obilabs.dev
              </a>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Delete Your Data</h3>
              <p className="text-gray-600 text-sm mb-4">
                Request deletion of all telemetry data for your instance.
              </p>
              <a href="mailto:privacy@obilabs.dev?subject=Data Deletion Request"
                className="text-primary-600 hover:underline text-sm">
                privacy@obilabs.dev
              </a>
            </div>
          </div>
        </section>

        {/* Open Source */}
        <section className="mb-12">
          <div className="bg-gray-100 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Audit Our Code</h2>
            <p className="text-gray-600 mb-4">
              Our telemetry code is open source. You can see exactly what we send:
            </p>
            <code className="bg-white px-3 py-2 rounded border border-gray-200 text-sm text-gray-800 block">
              lib/telemetry.ts · lib/alive-ping.ts · lib/telemetry-consent.ts
            </code>
            <p className="text-gray-500 text-sm mt-4">
              Every piece of data we collect is visible in the source code. No hidden tracking.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t border-gray-200 pt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Questions?</h2>
          <p className="text-gray-600">
            Email us at{' '}
            <a href="mailto:privacy@obilabs.dev" className="text-primary-600 hover:underline">
              privacy@obilabs.dev
            </a>
            {' '}or open a discussion on{' '}
            <a href="https://github.com/obilabs/Aegis/discussions"
              className="text-primary-600 hover:underline">
              GitHub
            </a>.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} ObiLabs. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700">Terms</Link>
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">Privacy</Link>
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">Home</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
