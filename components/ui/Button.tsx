'use client'

/**
 * Button — the single canonical button primitive for apps/aegis.
 *
 * Spec: openspec/specs/ui-primitives/spec.md (after archive)
 * Design: openspec/changes/ui-shared-primitives/design.md (D2, D6)
 *
 * Replaces the duplicated `bg-brand-600 hover:bg-brand-700 ...` class
 * string scattered across page files. CI gate
 * `Verify no shared-pattern class duplication` enforces no remaining
 * direct uses outside this file.
 *
 * What's baked in (intentional invariants):
 * - `whitespace-nowrap` — button text never wraps. This is the
 *   structural fix for the bug Mike hit on /portal/settings/api-keys
 *   on 2026-06-05.
 * - `flex-shrink-0` — the button shrinks to its content, not below.
 *   Squeezed siblings won't collapse it past readability.
 * - `disabled:opacity-50 disabled:cursor-not-allowed` — consistent
 *   disabled appearance, same regardless of variant.
 * - `transition-colors` — color changes animate on hover/active.
 *
 * No CVA, no tailwind-variants dependency. Just a switch map per
 * design D2.
 */

import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant. Default: `primary`. */
  variant?: Variant
  /** Padding + text-size. Default: `md`. */
  size?: Size
  /** Optional icon node rendered before children. */
  leftIcon?: React.ReactNode
  /** Optional icon node rendered after children. */
  rightIcon?: React.ReactNode
  /**
   * When true: button is disabled AND a spinner renders in place of
   * the leftIcon. Use during async submit / save / delete actions.
   */
  isLoading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium ' +
  'whitespace-nowrap flex-shrink-0 transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 focus:ring-offset-slate-900'

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      isLoading,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ''}`.trim()}
        {...rest}
      >
        {isLoading ? (
          <Spinner className={iconSize} />
        ) : leftIcon ? (
          <span className={`inline-flex items-center ${iconSize}`}>{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon ? (
          <span className={`inline-flex items-center ${iconSize}`}>{rightIcon}</span>
        ) : null}
      </button>
    )
  },
)
