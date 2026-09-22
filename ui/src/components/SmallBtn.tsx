import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; danger?: boolean }

/** Compact outlined button styled with host CSS variables. */
export function SmallBtn({ active, danger, disabled, style, className = '', ...rest }: Props) {
  const color = danger ? 'var(--danger)' : active ? 'var(--accent)' : 'var(--muted)'
  return (
    <button
      type="button"
      disabled={disabled}
      className={`px-2 py-0.5 rounded-md border text-[12px] transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:text-text'} ${className}`}
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        color,
        fontWeight: active ? 600 : 400,
        background: 'transparent',
        ...style,
      }}
      {...rest}
    />
  )
}
