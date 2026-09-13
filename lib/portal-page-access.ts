/**
 * Server-side page guard for portal sections (used from section layout.tsx
 * files). The navigation hides sections a role cannot use; this makes the
 * pages themselves refuse, so typing the URL does not render them.
 *
 *   export default async function Layout({ children }) {
 *     await ensurePageAccess({ level: 'staff' }, '/portal/assets')
 *     return children
 *   }
 *
 * Not signed in -> login (with callback). Signed in without the required
 * level/capability -> dashboard with ?denied=<section>.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { allows } from '@/lib/access-policy'
import { getUserId } from '@/lib/org'
import { getUserPermissions, type Capability } from '@/lib/permissions'

export async function ensurePageAccess(
  need: { level?: 'staff' | 'admin'; capability?: Capability },
  section: string,
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect(`/?callbackUrl=${encodeURIComponent(section)}`)
  }
  let userId: string | null = null
  try {
    userId = await getUserId(session.user.email)
  } catch {
    userId = null
  }
  const perms = userId ? await getUserPermissions(userId) : null
  if (!perms || !allows(perms, need)) {
    redirect(`/portal/dashboard?denied=${encodeURIComponent(section.replace(/^\/portal\//, ''))}`)
  }
}
