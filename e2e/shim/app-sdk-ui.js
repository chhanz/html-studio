// Minimal stand-ins for `@kirocrew/app-sdk/ui`, using the same class names the
// dashboard components render with so layout behaviour is comparable.
import { jsx, jsxs } from 'react/jsx-runtime'

export const Card = ({ children, className = '' }) =>
  jsx('div', { className: `border border-border bg-card rounded-lg p-5 shadow-sm ${className}`, children })

export const CardTitle = ({ children }) =>
  jsx('h3', { className: 'text-[15px] font-semibold text-text-strong mb-2', children })

export const PageHeader = ({ title, subtitle, children }) =>
  jsxs('div', {
    className: 'px-6 pt-4 pb-3',
    children: [
      jsx('h1', { className: 'text-2xl font-bold tracking-tight text-text-strong', children: title }),
      subtitle ? jsx('p', { className: 'text-[13px] text-muted mt-1', children: subtitle }) : null,
      children ?? null,
    ],
  })

export const StatCard = ({ label, value }) =>
  jsxs('div', { className: 'border border-border rounded-md p-3', children: [jsx('div', { className: 'text-muted text-xs', children: label }), jsx('div', { children: value })] })

const passthrough = (tag) => (props) => jsx(tag, props)
export const Btn = passthrough('button')
export const SendBtn = passthrough('button')
export const Input = passthrough('input')
export const SearchInput = passthrough('input')
export const Badge = passthrough('span')
export const AimBadge = passthrough('span')
export const Skeleton = passthrough('div')
export const ContentSkeleton = passthrough('div')
export const EmptyState = passthrough('div')
export const Toggle = passthrough('button')
export const InfoTip = passthrough('span')
export const SegmentedControl = passthrough('div')
export const MarkdownRenderer = ({ children }) => jsx('div', { children })
