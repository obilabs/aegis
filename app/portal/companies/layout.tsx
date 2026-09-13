import { ensurePageAccess } from '@/lib/portal-page-access'

export const dynamic = 'force-dynamic'

// Staff only: end users do not see organization records.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await ensurePageAccess({ level: 'staff' }, '/portal/companies')
  return <>{children}</>
}
