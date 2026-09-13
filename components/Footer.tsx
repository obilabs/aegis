import Link from 'next/link'
import { Shield, Github } from 'lucide-react'

const footerLinks = {
  Product: [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/#pricing' },
    { name: 'MSP Program', href: '/msp' },
  ],
  Resources: [
    { name: 'Documentation', href: 'https://github.com/obilabs/aegis#readme' },
    { name: 'GitHub', href: 'https://github.com/obilabs/aegis' },
    { name: 'Support', href: '/portal/support' },
  ],
  Company: [
    { name: 'Waitlist', href: '/waitlist' },
    { name: 'Credits', href: '/credits' },
    { name: 'Insights', href: '/insights' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-white mb-4">
              <Shield className="h-8 w-8" />
              <span className="text-xl font-bold">Aegis</span>
            </Link>
            <p className="text-sm mb-4">
              Open source IT Service Management platform.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/obilabs/aegis"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-white font-semibold mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-white transition"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm hover:text-white transition"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ObiLabs. All rights reserved.
          </p>
          <p className="text-sm">
            Breaking vendor lock-in through client data sovereignty.
          </p>
        </div>
      </div>
    </footer>
  )
}
