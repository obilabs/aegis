'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Shield, Github } from 'lucide-react'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Aegis</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-gray-600 hover:text-gray-900 transition">
              Features
            </a>
            <a href="/#pricing" className="text-gray-600 hover:text-gray-900 transition">
              Pricing
            </a>
            <a
              href="https://github.com/obilabs/aegis#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Docs
            </a>
            <a
              href="https://github.com/obilabs/aegis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/portal/login"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Login
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-4">
              <a href="/#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="/#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="https://github.com/obilabs/aegis#readme" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900">Docs</a>
              <a
                href="https://github.com/obilabs/aegis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <Github className="h-5 w-5" />
                GitHub
              </a>
              <Link
                href="/portal/login"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-center font-medium"
              >
                Login
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
