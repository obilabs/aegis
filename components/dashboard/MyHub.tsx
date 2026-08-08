'use client'

import { QuickActions } from './QuickActions'
import { PolicyProgressWidget } from './PolicyProgressWidget'
import { TrainingProgressWidget } from './TrainingProgressWidget'
import { MySoftwareWidget } from './MySoftwareWidget'
import { MyHardwareWidget } from './MyHardwareWidget'
import { MyTicketsWidget } from './MyTicketsWidget'

interface MyHubProps {
  userName: string
  jobTitle?: string
  department?: string
}

export function MyHub({ userName, jobTitle, department }: MyHubProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome, {userName.split(' ')[0]}
        </h1>
        {(jobTitle || department) && (
          <p className="text-slate-400 mt-1">
            {[jobTitle, department].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column: Tickets + Compliance */}
        <div className="space-y-5">
          <MyTicketsWidget />
          <PolicyProgressWidget />
        </div>

        {/* Right column: Training + Assets */}
        <div className="space-y-5">
          <TrainingProgressWidget />
          <MySoftwareWidget />
          <MyHardwareWidget />
        </div>
      </div>
    </div>
  )
}
