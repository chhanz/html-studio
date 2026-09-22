import { useState } from 'react'
import type { BuildResult } from '../api'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  result: BuildResult | null
  pendingCommand: string | null
  onTrust: () => void
  onCancelTrust: () => void
  onOpenIssue: (file: string) => void
  onDismiss: () => void
}

export function BuildPanel({ t, result, pendingCommand, onTrust, onCancelTrust, onOpenIssue, onDismiss }: Props) {
  const [showLog, setShowLog] = useState(false)

  if (pendingCommand) {
    return (
      <div className="rounded-md border p-3 text-[13px] flex flex-col gap-2" style={{ borderColor: 'var(--warn)' }} role="dialog" aria-label={t('build.trust.title')}>
        <div className="font-semibold">{t('build.trust.title')}</div>
        <p className="m-0 text-muted">{t('build.trust.body')}</p>
        <pre
          className="m-0 p-2 rounded-md text-[12px] overflow-auto whitespace-pre-wrap break-all"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', maxHeight: 160 }}
        >
          {pendingCommand}
        </pre>
        <div className="flex gap-2">
          <SmallBtn active onClick={onTrust}>{t('build.trust.accept')}</SmallBtn>
          <SmallBtn onClick={onCancelTrust}>{t('build.trust.cancel')}</SmallBtn>
        </div>
      </div>
    )
  }

  if (!result || result.needsTrust) return null

  const color = result.ok ? 'var(--ok)' : 'var(--danger)'
  const secs = ((result.durationMs ?? 0) / 1000).toFixed(1)
  const issues = result.issues ?? []
  const log = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

  return (
    <div className="rounded-md border p-3 text-[13px] flex flex-col gap-2" style={{ borderColor: color }} role="status">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold" style={{ color }}>
          {result.ok ? t('build.ok', { s: secs }) : t('build.failed', { s: secs })}
        </span>
        <span className="text-muted">
          · {result.mode === 'builtin' ? t('build.mode.builtin') : t('build.mode.external')}
          {result.output ? ` · ${result.output}` : ''}
        </span>
        <span className="ml-auto flex gap-1">
          {log && <SmallBtn onClick={() => setShowLog((v) => !v)} active={showLog}>{t('build.log')}</SmallBtn>}
          <SmallBtn onClick={onDismiss} aria-label={t('build.dismiss')}>✕</SmallBtn>
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-1">
          {issues.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onOpenIssue(it.file)}
                className="w-full text-left px-2 py-1 rounded-md cursor-pointer bg-transparent border-0 hover:bg-bg-hover"
                title={t('build.issue.open')}
              >
                <span className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>{it.file}</span>
                <span className="text-muted">: {it.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!result.ok && issues.length === 0 && result.stderr && (
        <p className="m-0 text-muted whitespace-pre-wrap break-all">{result.stderr.split('\n').slice(-5).join('\n')}</p>
      )}
      {showLog && log && (
        <pre
          className="m-0 p-2 rounded-md text-[11px] overflow-auto whitespace-pre-wrap break-all"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', maxHeight: 220 }}
        >
          {log}
        </pre>
      )}
    </div>
  )
}
