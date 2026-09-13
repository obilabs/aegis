'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, type JSX } from 'react'
import { useSession, signOut } from '@/lib/auth-client'
import { NewItemDropdown } from '@/components/NewItemDropdown'
import GlobalSearch from '@/components/GlobalSearch'
import { FeatureProvider, useFeatures } from '@/lib/hooks/useFeatures'
import { FEATURES } from '@/lib/features'
import { VendorFooter } from '@/components/VendorFooter'

interface NavItem {
  name: string
  href: string
  icon: (props: { className?: string }) => JSX.Element
  featureKey?: string
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/portal/dashboard', icon: HomeIcon },
  { name: 'Queue', href: '/portal/queue', icon: QueueIcon, featureKey: 'smart_queue' },
  { name: 'Incidents', href: '/portal/tickets?type=incident', icon: TicketIcon },
  { name: 'Requests', href: '/portal/requests', icon: InboxIcon, featureKey: 'service_catalog' },
  { name: 'Assets', href: '/portal/assets', icon: ServerIcon, featureKey: 'assets' },
  { name: 'Companies', href: '/portal/companies', icon: BuildingIcon, featureKey: 'companies' },
  { name: 'Contacts', href: '/portal/contacts', icon: UsersIcon },
  { name: 'Knowledge Base', href: '/portal/kb', icon: BookIcon, featureKey: 'knowledge_base' },
  { name: 'AI Assistant', href: '/portal/chat', icon: SparklesIcon, featureKey: 'ai_chat' },
  { name: 'Documents', href: '/portal/documents', icon: DocumentIcon },
  { name: 'Credentials', href: '/portal/credentials', icon: KeyIcon, featureKey: 'credential_vault' },
  { name: 'Operations', href: '/portal/operations', icon: OperationsIcon, featureKey: 'workflows' },
  { name: 'Reports', href: '/portal/reports', icon: ReportIcon },
  { name: 'Groups', href: '/portal/groups', icon: GroupsIcon, featureKey: 'teams' },
]

const adminNavigation: NavItem[] = [
  { name: 'Team Backlog', href: '/portal/backlog', icon: BacklogIcon, featureKey: 'teams' },
  { name: 'Activity Log', href: '/portal/activity', icon: ClockIcon },
  { name: 'Provider Access', href: '/portal/providers', icon: ShieldIcon, featureKey: 'provider_access' },
  { name: 'Policies', href: '/portal/policies', icon: PolicyIcon, featureKey: 'policies' },
  { name: 'Settings', href: '/portal/settings', icon: CogIcon },
]

function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  )
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  )
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

function OperationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function GroupsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function BacklogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function StickyNoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  )
}

function PolicyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
    </svg>
  )
}

interface QuickNote {
  id: string
  content: string
  created_at: string
}

interface MyTask {
  id: string
  title: string
  is_completed: boolean
  is_required: boolean
  ticket_id: string
  ticket_number: number
  prefix: string
  ticket_subject: string
  ticket_status: string
  ticket_status_color: string
  ticket_priority: string
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FeatureProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </FeatureProvider>
  )
}

/** Helper to get badge info for a feature-gated nav item */
function getFeatureBadge(featureKey?: string): { text: string; color: string } | null {
  if (!featureKey) return null
  const feature = FEATURES[featureKey]
  if (!feature) return null
  if (feature.status === 'beta') return { text: 'BETA', color: 'bg-amber-500/20 text-amber-400' }
  if (feature.status === 'alpha') return { text: 'ALPHA', color: 'bg-purple-500/20 text-purple-400' }
  if (feature.status === 'coming_soon') return { text: 'SOON', color: 'bg-slate-500/20 text-slate-400' }
  return null
}

// These pages have their own layout (no sidebar).
const STANDALONE_PAGES = ['/portal/login', '/portal/setup', '/portal/two-factor']

function PortalLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  // Choose standalone vs. shell before any other hook runs. The layout instance
  // survives client-side navigation, so an early return placed above hooks
  // changes the hook count between renders: signing in (login -> dashboard)
  // crashed the page with React error #310.
  const pathname = usePathname()
  if (STANDALONE_PAGES.some(page => pathname.startsWith(page))) {
    return <>{children}</>
  }
  return <PortalShell pathname={pathname}>{children}</PortalShell>
}

function PortalShell({
  children,
  pathname,
}: {
  children: React.ReactNode
  pathname: string
}) {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Top-bar widgets
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  const [showTasksPanel, setShowTasksPanel] = useState(false)
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const notesPanelRef = useRef<HTMLDivElement>(null)
  const tasksPanelRef = useRef<HTMLDivElement>(null)
  const [permissions, setPermissions] = useState<{
    capabilities: string[]
    ticketAccess: string
    adminAccess: boolean
  } | null>(null)
  // Retroactive telemetry-consent banner — shown once per session to
  // admins on installs that haven't recorded an explicit consent choice
  // yet. PRINCIPLES.md #2 (consent-first telemetry). Dismissal is
  // localStorage-only; banner reappears next session if no real consent
  // change was made via /portal/settings/telemetry.
  const [showTelemetryBanner, setShowTelemetryBanner] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push('/portal/login')
    router.refresh()
  }

  // Fetch notes, tasks, and permissions for top-bar widgets + sidebar
  useEffect(() => {
    if (session?.user) {
      fetchNotes()
      fetchMyTasks()
      fetchPermissions()
      fetchTelemetryBannerState()
    }
  }, [session?.user])

  const fetchTelemetryBannerState = async () => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('telemetry-banner-dismissed') === '1') {
      setShowTelemetryBanner(false)
      return
    }
    try {
      const res = await fetch('/api/portal/telemetry-consent-banner')
      if (res.ok) {
        const data = await res.json()
        setShowTelemetryBanner(!!data.show)
      }
    } catch { /* non-critical */ }
  }

  const dismissTelemetryBanner = () => {
    setShowTelemetryBanner(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('telemetry-banner-dismissed', '1')
    }
  }

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/portal/permissions')
      if (res.ok) {
        setPermissions(await res.json())
      }
    } catch { /* non-critical */ }
  }

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/portal/notes')
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes || [])
      }
    } catch { /* non-critical */ }
  }

  const fetchMyTasks = async () => {
    try {
      const res = await fetch('/api/portal/my-tasks')
      if (res.ok) {
        const data = await res.json()
        setMyTasks(data.tasks || [])
      }
    } catch { /* non-critical */ }
  }

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/portal/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes([note, ...notes])
        setNewNoteContent('')
      }
    } catch { /* non-critical */ }
    finally { setSavingNote(false) }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/portal/notes/${noteId}`, { method: 'DELETE' })
      if (res.ok) {
        setNotes(notes.filter(n => n.id !== noteId))
      }
    } catch { /* non-critical */ }
  }

  // Close panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showNotesPanel && notesPanelRef.current && !notesPanelRef.current.contains(e.target as Node)) {
        setShowNotesPanel(false)
      }
      if (showTasksPanel && tasksPanelRef.current && !tasksPanelRef.current.contains(e.target as Node)) {
        setShowTasksPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotesPanel, showTasksPanel])

  const user = session?.user
  const isAdmin = permissions?.adminAccess || (user as Record<string, unknown>)?.role === 'admin'
  const hasSettings = isAdmin || permissions?.capabilities?.includes('settings')
  const hasReports = isAdmin || permissions?.capabilities?.includes('reports')
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U'
  const pendingTaskCount = myTasks.filter(t => !t.is_completed).length

  // Feature-gated navigation
  const { isEnabled } = useFeatures()
  const visibleNav = navigation.filter(item => {
    if (!item.featureKey) return true
    return isEnabled(item.featureKey)
  })
  const visibleAdminNav = adminNavigation.filter(item => {
    if (!item.featureKey) return true
    return isEnabled(item.featureKey)
  })

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-4 lg:gap-8">
              {/* Mobile menu button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              
              <Link href="/portal/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white tracking-tight hidden sm:block">Aegis</span>
              </Link>
              
              {/* Quick Actions */}
              <div className="hidden md:flex items-center gap-2">
                <NewItemDropdown />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="hidden lg:block">
                <GlobalSearch />
              </div>
              
              {/* Notes Widget */}
              <div className="relative" ref={notesPanelRef}>
                <button
                  onClick={() => { setShowNotesPanel(!showNotesPanel); setShowTasksPanel(false) }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
                  title="Quick Notes"
                >
                  <StickyNoteIcon className="h-5 w-5" />
                  {notes.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 text-[10px] font-bold bg-brand-500 text-white rounded-full flex items-center justify-center">
                      {notes.length}
                    </span>
                  )}
                </button>
                {showNotesPanel && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">Quick Notes</h3>
                      <Link
                        href="/portal/notes"
                        onClick={() => setShowNotesPanel(false)}
                        className="text-xs text-brand-400 hover:text-brand-300"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="p-3 border-b border-slate-700">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !savingNote) handleAddNote() }}
                          placeholder="Jot something down..."
                          className="flex-1 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                          disabled={savingNote}
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!newNoteContent.trim() || savingNote}
                          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notes.length === 0 ? (
                        <p className="p-4 text-center text-sm text-slate-500">No notes yet</p>
                      ) : (
                        notes.map((note) => (
                          <div key={note.id} className="px-3 py-2 border-b border-slate-700/50 group hover:bg-slate-700/30 flex items-start gap-2">
                            <p className="flex-1 text-sm text-slate-300 break-words">{note.content}</p>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* My Tasks Widget */}
              <div className="relative" ref={tasksPanelRef}>
                <button
                  onClick={() => { setShowTasksPanel(!showTasksPanel); setShowNotesPanel(false); fetchMyTasks() }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
                  title="My Tasks"
                >
                  <ChecklistIcon className="h-5 w-5" />
                  {pendingTaskCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 text-[10px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                      {pendingTaskCount > 9 ? '9+' : pendingTaskCount}
                    </span>
                  )}
                </button>
                {showTasksPanel && (
                  <div className="absolute right-0 mt-2 w-96 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">
                        My Tasks
                        {pendingTaskCount > 0 && (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {pendingTaskCount} pending
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {myTasks.length === 0 ? (
                        <p className="p-4 text-center text-sm text-slate-500">No tasks assigned to you</p>
                      ) : (
                        myTasks.filter(t => !t.is_completed).map((task) => {
                          const tNum = `${task.prefix || 'TKT'}-${String(task.ticket_number).padStart(4, '0')}`
                          return (
                            <Link
                              key={task.id}
                              href={`/portal/tickets/${task.ticket_id}`}
                              onClick={() => setShowTasksPanel(false)}
                              className="block px-3 py-2.5 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                  task.ticket_priority === 'critical' ? 'bg-red-500' :
                                  task.ticket_priority === 'high' ? 'bg-orange-500' :
                                  task.ticket_priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`} />
                                <span className="text-sm text-slate-200 truncate">{task.title}</span>
                                {task.is_required && (
                                  <span className="flex-shrink-0 px-1 py-0.5 text-[9px] font-medium bg-red-500/20 text-red-400 rounded">
                                    REQ
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 ml-4">
                                <span className="text-xs text-slate-500 font-mono">{tNum}</span>
                                <span className="text-xs text-slate-500 truncate">{task.ticket_subject}</span>
                              </div>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">{userInitial}</span>
                  </div>
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{user?.name || 'Administrator'}</p>
                    </div>
                    <Link
                      href="/portal/account/api-keys"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                      onClick={() => setShowDropdown(false)}
                    >
                      API Keys
                    </Link>
                    <Link
                      href="/portal/account"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                      onClick={() => setShowDropdown(false)}
                    >
                      My Account
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar - Hidden on mobile, shown on lg+ */}
        <aside className={`sticky top-14 hidden lg:flex bg-slate-900 border-r border-slate-800 h-[calc(100vh-3.5rem)] flex-col transition-all duration-300 overflow-y-auto ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
          {/* Collapse Toggle */}
          <div className="p-2 flex justify-end border-b border-slate-800">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          
          <nav className="flex-1 p-2 space-y-1">
            {visibleNav.map((item) => {
              const isActive = pathname.startsWith(item.href.split('?')[0])
              const badge = getFeatureBadge(item.featureKey)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate">{item.name}</span>
                      {badge && (
                        <span className={`ml-auto flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded ${badge.color}`}>
                          {badge.text}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}

            {/* Admin Section — only visible to admins */}
            {isAdmin && visibleAdminNav.length > 0 && (
              <div className="pt-4 mt-4 border-t border-slate-800">
                {!sidebarCollapsed && (
                  <p className="px-3 mb-2 text-xs font-medium text-slate-600 uppercase tracking-wider">Admin</p>
                )}
                {visibleAdminNav.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  const badge = getFeatureBadge(item.featureKey)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {badge && (
                            <span className={`ml-auto flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded ${badge.color}`}>
                              {badge.text}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </nav>
          
          {/* Sidebar Footer */}
          <div className="p-2 border-t border-slate-800">
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                <div className="p-2 rounded-lg bg-slate-800/50">
                  <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-500">Aegis ITSM</p>
                <p className="text-xs text-slate-600 mt-0.5">v1.0.0 • Community</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto min-w-0">
          {/* Retroactive telemetry-consent banner — admin-only, one-time
              per session, hidden once an explicit consent choice exists
              in telemetry_consent_log. PRINCIPLES.md #2. */}
          {showTelemetryBanner && isAdmin && (
            <div className="mb-4 bg-amber-950/30 border border-amber-800/40 rounded-lg p-4 flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-200">
                  <span className="font-medium">Telemetry consent: action recommended.</span>{' '}
                  We added a consent flow for outbound telemetry. Your install is
                  currently sending heartbeats per the previous default — confirm
                  or change in Settings → Telemetry &amp; Privacy.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Link
                    href="/portal/settings/telemetry"
                    className="text-sm font-medium text-amber-300 hover:text-amber-200 underline"
                    onClick={dismissTelemetryBanner}
                  >
                    Open settings
                  </Link>
                  <button
                    type="button"
                    onClick={dismissTelemetryBanner}
                    className="text-sm text-amber-400/70 hover:text-amber-300"
                  >
                    Dismiss for now
                  </button>
                </div>
              </div>
            </div>
          )}
          {isPending ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <VendorFooter />

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-50 lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <Link href="/portal/dashboard" className="flex items-center gap-2" onClick={() => setShowMobileMenu(false)}>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white tracking-tight">Aegis</span>
              </Link>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {visibleNav.map((item) => {
                const isActive = pathname.startsWith(item.href.split('?')[0])
                const badge = getFeatureBadge(item.featureKey)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                    {badge && (
                      <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-semibold rounded ${badge.color}`}>
                        {badge.text}
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* Admin Section — only visible to admins */}
              {isAdmin && visibleAdminNav.length > 0 && (
                <div className="pt-4 mt-4 border-t border-slate-800">
                  <p className="px-3 mb-2 text-xs font-medium text-slate-600 uppercase tracking-wider">Admin</p>
                  {visibleAdminNav.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    const badge = getFeatureBadge(item.featureKey)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setShowMobileMenu(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                        {badge && (
                          <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-semibold rounded ${badge.color}`}>
                            {badge.text}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
