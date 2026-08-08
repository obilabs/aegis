import {
  Users,
  Mail,
  Shield,
  Zap,
  BarChart3,
  Settings,
  Cloud,
  Lock
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'User Management',
    description: 'Sync and manage users from Google Workspace. View profiles, departments, and org charts.',
  },
  {
    icon: Mail,
    title: 'Email Signatures',
    description: 'Deploy consistent, branded email signatures across your organization automatically.',
  },
  {
    icon: Shield,
    title: 'Security Controls',
    description: 'Monitor external sharing, review permissions, and maintain compliance.',
  },
  {
    icon: Zap,
    title: 'Automation',
    description: 'Onboarding and offboarding workflows. Scheduled actions. Bulk operations.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Track email engagement, user activity, and generate reports.',
  },
  {
    icon: Settings,
    title: 'Custom Modules',
    description: 'Enable only what you need. Extensible architecture for your requirements.',
  },
  {
    icon: Cloud,
    title: 'Self-Hosted or Managed',
    description: 'Run on your own infrastructure or let us handle everything.',
  },
  {
    icon: Lock,
    title: 'Your Data, Your Control',
    description: 'No vendor lock-in. Export anytime. Open source core.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage Google Workspace
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A modern admin portal that actually makes sense.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
