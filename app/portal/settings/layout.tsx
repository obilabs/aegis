import { ensurePageAccess } from '@/lib/portal-page-access'

export const dynamic = 'force-dynamic'

// Settings are for administrators (or roles with the settings capability).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await ensurePageAccess({ capability: 'settings' }, '/portal/settings')
  return <>{children}</>
}
