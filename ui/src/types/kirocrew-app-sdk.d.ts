// The dashboard injects these modules at runtime (see vite.config.ts externals).
// No type package is published, so declare the surface we use here.
declare module '@kirocrew/app-sdk' {
  export interface AppApi {
    get<T = any>(path: string, init?: RequestInit): Promise<T>
    post<T = any>(path: string, body?: unknown): Promise<T>
    put<T = any>(path: string, body?: unknown): Promise<T>
    patch<T = any>(path: string, body?: unknown): Promise<T>
  }
  export function useAppApi(): AppApi
  export function useAppEvents(...args: any[]): any
  export function useTheme(): any
  export function useAppInfo(): any
  export function useNavigate(): (to: string) => void
  export function useNotify(): any
  export function useChatLauncher(): { openChat(opts: { agent?: string; message?: string }): void }
}

declare module '@kirocrew/app-sdk/ui' {
  import type { ComponentType, ReactNode } from 'react'
  export const PageHeader: ComponentType<{ title: ReactNode; subtitle?: ReactNode; children?: ReactNode }>
  export const Card: ComponentType<{ children?: ReactNode; className?: string }>
  export const CardTitle: ComponentType<{ children?: ReactNode }>
  export const StatCard: ComponentType<{ label: ReactNode; value: ReactNode; accent?: boolean }>
  export const Btn: ComponentType<any>
  export const Badge: ComponentType<any>
  export const Input: ComponentType<any>
  export const Toggle: ComponentType<any>
  export const SegmentedControl: ComponentType<any>
  export const EmptyState: ComponentType<any>
  export const MarkdownRenderer: ComponentType<any>
}

declare module 'lucide-react'
