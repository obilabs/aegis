import Link from 'next/link'
import { Sun, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Sun className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Aegis</span>
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-6">Last updated: December 2024</p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-4">
            By accessing or using Aegis, you agree to be bound by these Terms of Service.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Open Source License</h2>
          <p className="text-gray-600 mb-4">
            Aegis Client is released under the MIT License. You are free to use, modify, and distribute
            the software in accordance with the license terms.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Cloud Hosting Service</h2>
          <p className="text-gray-600 mb-4">
            If you use our Cloud hosting service (when available), additional terms will apply.
            We provide infrastructure hosting only - you are responsible for your own data and
            Google Workspace configuration.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Your Responsibilities</h2>
          <p className="text-gray-600 mb-4">
            You are responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Securing your own instance and credentials</li>
            <li>Complying with Google Workspace terms of service</li>
            <li>Ensuring your use complies with applicable laws</li>
            <li>Maintaining backups of your data</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
          <p className="text-gray-600 mb-4">
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND. IN NO EVENT SHALL THE
            AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Contact</h2>
          <p className="text-gray-600 mb-4">
            For questions about these terms, please open an issue on our{' '}
            <a href="https://github.com/obilabs/Aegis" className="text-primary-600 hover:underline">
              GitHub repository
            </a>.
          </p>
        </div>
      </main>
    </div>
  )
}
