import Link from 'next/link'
import { ArrowRight, Github } from 'lucide-react'

export function CTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          Ready to take control of your IT services?
        </h2>
        <p className="text-xl text-white/80 mb-10">
          Free and open source. Deploy in minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/obilabs/aegis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition font-medium text-lg"
          >
            <Github className="h-5 w-5" />
            Get Started on GitHub
          </a>
          <Link
            href="/waitlist"
            className="inline-flex items-center gap-2 text-white border border-white/30 px-8 py-4 rounded-lg hover:bg-white/10 transition font-medium text-lg"
          >
            Join Cloud Waitlist
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
