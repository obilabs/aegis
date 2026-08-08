'use client'

import Link from 'next/link'
import {
  PlusIcon,
  SparklesIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'

interface QuickActionsProps {
  aiEnabled?: boolean
}

export function QuickActions({ aiEnabled = true }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/portal/request"
        className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors text-sm font-medium"
      >
        <PlusIcon className="h-4 w-4" />
        New Request
      </Link>
      {aiEnabled && (
        <Link
          href="/portal/chat"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium border border-slate-600"
        >
          <SparklesIcon className="h-4 w-4 text-brand-400" />
          Ask AI
        </Link>
      )}
      <Link
        href="/portal/kb"
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium border border-slate-600"
      >
        <BookOpenIcon className="h-4 w-4 text-yellow-400" />
        Browse KB
      </Link>
    </div>
  )
}
