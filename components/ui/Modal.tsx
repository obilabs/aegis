'use client'

/**
 * Modal — the single canonical modal primitive for apps/aegis.
 *
 * Spec: openspec/specs/ui-primitives/spec.md (after archive)
 * Design: openspec/changes/ui-shared-primitives/design.md (D3, D6)
 *
 * Replaces the duplicated `fixed inset-0 bg-black/50 ...` wrapper
 * pattern scattered across page files. CI gate enforces no remaining
 * direct uses outside this file.
 *
 * Top-anchored scroll pattern is baked in: the outer wrapper uses
 * `flex items-start justify-center overflow-y-auto py-8`. There is
 * NO escape hatch for vertical centering — the failure mode of
 * `items-center` + `overflow-y-auto` is exactly the cut-off bug we
 * fixed on /portal/settings/api-keys on 2026-06-05. Short modals
 * sit near the top instead of vertically centered — accepted
 * trade-off for guaranteed scrollability.
 *
 * Behaviors baked in:
 * - ESC closes (opt out with `closeOnEscape={false}`)
 * - Backdrop click closes (opt out with `closeOnBackdrop={false}`)
 * - `open={false}` returns null (unmounts; no display:none tricks)
 * - Body scroll-lock applied while the modal is open
 *
 * Sub-components Modal.Header / Modal.Body / Modal.Footer give
 * consistent spacing without locking layout.
 */

import React, { useEffect } from 'react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  /** Render the modal when true; unmount entirely when false. */
  open: boolean
  /** Called by ESC key, backdrop click, or anything else that requests close. */
  onClose: () => void
  /** Maximum width of the inner card. Default: `md`. */
  size?: Size
  /** Default true. Set false to require explicit close via UI. */
  closeOnEscape?: boolean
  /** Default true. Set false for destructive-confirm modals. */
  closeOnBackdrop?: boolean
  /** Children. Use Modal.Header / Modal.Body / Modal.Footer for spacing. */
  children: React.ReactNode
}

const SIZE_TO_MAX_W: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

const OUTER =
  'fixed inset-0 bg-black/50 z-50 flex items-start justify-center ' +
  'overflow-y-auto py-8'

const CARD = 'bg-slate-900 border border-slate-700 rounded-xl w-full mx-4 my-0'

function ModalRoot({
  open,
  onClose,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  // ESC handling. Effect re-installs whenever `closeOnEscape`/`onClose`
  // identity changes — cheap, and avoids stale closures.
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, closeOnEscape, onClose])

  // Body scroll-lock. Without this the body scrolls under the backdrop
  // when the modal itself overflows, which is disorienting.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open) return null

  return (
    <div
      className={OUTER}
      onClick={(e) => {
        // Only fire when the backdrop itself receives the click — clicks
        // inside the card bubble up to its parent (the same div), so we
        // must check `e.target === e.currentTarget`.
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`${CARD} ${SIZE_TO_MAX_W[size]}`}>{children}</div>
    </div>
  )
}

function ModalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 border-b border-slate-800 ${className ?? ''}`.trim()}>
      {children}
    </div>
  )
}

function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 ${className ?? ''}`.trim()}>{children}</div>
}

function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`p-6 border-t border-slate-800 flex justify-end gap-3 ${className ?? ''}`.trim()}
    >
      {children}
    </div>
  )
}

type ModalComponent = typeof ModalRoot & {
  Header: typeof ModalHeader
  Body: typeof ModalBody
  Footer: typeof ModalFooter
}

export const Modal = ModalRoot as ModalComponent
Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter
