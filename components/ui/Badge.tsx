'use client'

/**
 * Badge — the single canonical badge primitive for apps/aegis.
 *
 * Spec: openspec/specs/ui-primitives/spec.md (after archive)
 * Design: openspec/changes/ui-shared-primitives/design.md (D6)
 *
 * Replaces the ad-hoc TYPE_COLOR / CONTEXT_COLOR / PERMISSION_COLOR
 * maps and scattered `px-2 py-0.5 text-xs bg-X-500/20 text-X-400
 * rounded` class strings across page files. Semantic tone props
 * (`brand`, `blue`, `amber`, `red`, `slate`, `purple`, `emerald`)
 * keep colors consistent across surfaces.
 *
 * Tone semantics:
 * - `brand`    — selected / featured / on-brand accent
 * - `blue`     — informational / read-only / neutral positive
 * - `amber`    — warning / write-level / pending / migration flag
 * - `red`      — destructive / error / banned / revoked
 * - `slate`    — disabled / muted (default)
 * - `purple`   — categorical accent (matches existing TYPE_COLOR maps)
 * - `emerald`  — success (kept distinct from `brand` for non-brand-tied green)
 */

import React from 'react'

type Tone = 'brand' | 'blue' | 'amber' | 'red' | 'slate' | 'purple' | 'emerald'

export interface BadgeProps {
  /** Semantic tone. Default: `slate`. */
  tone?: Tone
  /** Optional icon rendered before the text. */
  leftIcon?: React.ReactNode
  /** Badge text/content. */
  children: React.ReactNode
  /** Extra Tailwind classes if a one-off override is genuinely needed. */
  className?: string
  /**
   * Runtime-computed colour. The ONLY legitimate use is a value Tailwind cannot
   * express as a class because it comes from data — e.g. `ticket_statuses.color`,
   * which an admin picks per status.
   *
   * Do NOT reach for this to pass colour utility classes; `tone` exists for that.
   * Passing `bg-*`/`border-*` through `className` puts them at the same
   * specificity as TONES and the winner is decided by stylesheet order, not by
   * what you wrote. An inline style is deterministic, which is why the escape
   * hatch is a style and not a class.
   */
  style?: React.CSSProperties
}

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  slate: 'bg-slate-700/40 text-slate-300 border-slate-700',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

const BASE =
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ' +
  'whitespace-nowrap'

export function Badge({
  tone = 'slate',
  leftIcon,
  children,
  className,
  style,
}: BadgeProps) {
  return (
    <span className={`${BASE} ${TONES[tone]} ${className ?? ''}`.trim()} style={style}>
      {leftIcon ? (
        <span className="inline-flex items-center h-3 w-3">{leftIcon}</span>
      ) : null}
      {children}
    </span>
  )
}
