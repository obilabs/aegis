import { ensurePageAccess } from '@/lib/portal-page-access'

export const dynamic = 'force-dynamic'

// Administrators only.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await ensurePageAccess({ level: 'admin' }, '/portal/activity')
  return <>{children}</>
}
