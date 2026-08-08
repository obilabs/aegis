'use client'

import { ArrowRight, Github, Server } from 'lucide-react'

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-600"></span>
          </span>
          Open Source & Self-Hostable
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          IT Service Management
          <br />
          <span className="text-primary-600">Without Vendor Lock-in</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Manage tickets, assets, and IT services with a modern interface.
          Self-host for free. Your data stays on your infrastructure.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="https://github.com/obilabs/aegis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-lg hover:bg-primary-700 transition font-medium text-lg"
          >
            <Github className="h-5 w-5" />
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href="https://github.com/obilabs/aegis#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-900 px-8 py-4 rounded-lg hover:bg-gray-200 transition font-medium text-lg"
          >
            Read the Docs
          </a>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span>Self-hostable</span>
          </div>
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            <span>Open Source</span>
          </div>
          <div className="flex items-center gap-2">
            <span>No vendor lock-in</span>
          </div>
        </div>

        {/* Dashboard Preview - Live Demo */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
          <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-800">
            {/* Browser Chrome */}
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-gray-400 text-sm">aegis.yourcompany.com</span>
              </div>
            </div>
            {/* Embedded Demo Dashboard */}
            <iframe
              src="/demo"
              title="Aegis Dashboard Demo"
              className="w-full aspect-video border-0"
              loading="eager"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
