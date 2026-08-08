/**
 * /msp on apps/aegis redirects to the canonical marketing page on
 * apps/web. apps/aegis is a self-hosted ITSM appliance — marketing
 * copy doesn't belong here. The previous content (light-theme purple
 * hero, "Coming Soon" copy claiming MTP was unreleased) was a stale UI
 * lie and a brand inconsistency — see PRINCIPLES.md #3 (retrospective
 * transparency).
 *
 * Target derived from NEXT_PUBLIC_VENDOR_URL (same env var
 * VendorFooter uses) so air-gapped installs that set
 * NEXT_PUBLIC_VENDOR_URL='' get a no-op redirect to the operator's
 * own root (avoids hard-coding api.obilabs.dev / aegis.agu.ca).
 */
import { redirect } from 'next/navigation'

export default function MspPage() {
  const vendorUrl = process.env.NEXT_PUBLIC_VENDOR_URL || 'https://api.obilabs.dev'
  redirect(vendorUrl ? `${vendorUrl}/msp` : '/')
}
