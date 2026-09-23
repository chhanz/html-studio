import type { CheckIssue, CheckResult, CheckSeverity } from '../api'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  result: CheckResult
  /** Issues already turned into pins (by issue key), shown as such. */
  pinned: Set<string>
  onJump: (slideIndex: number) => void
  onFix: (issue: CheckIssue) => void
  onFixAll: () => void
  onClose: () => void
}

const SEV_COLOR: Record<CheckSeverity, string> = { error: 'var(--danger)', warning: 'var(--warn)', info: 'var(--muted)' }

/** Stable identity of an issue across re-runs (for "already pinned"). */
export function issueKey(i: CheckIssue): string {
  return `${i.rule}|${i.slideIndex}|${i.selector}|${i.otherSelector ?? ''}`
}

/**
 * Result of a deck check: one row per issue with a rule label, the element
 * and the measured detail. "Fix" turns the row into a pin (P2 flow), so the
 * check is just an automatic way of placing pins.
 */
export function CheckPanel({ t, result, pinned, onJump, onFix, onFixAll, onClose }: Props) {
  const issues = result.issues
  const bySlide = new Map<number, CheckIssue[]>()
  for (const i of issues) bySlide.set(i.slideIndex, [...(bySlide.get(i.slideIndex) ?? []), i])
  const unpinned = issues.filter((i) => !pinned.has(issueKey(i)))
  return (
    <div className="mb-2 rounded-md border border-border p-2 text-[12px]" data-testid="check-panel" role="region" aria-label={t('toolbar.check')} style={{ flex: '0 1 auto', minHeight: 72, maxHeight: '45%', overflowY: 'auto' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-medium text-text">{issues.length ? t('check.title', { n: issues.length }) : t('check.clean', { n: result.slides })}</span>
        {Object.entries(result.counts).map(([rule, n]) => (
          <span key={rule} className="rounded-sm px-1" style={{ border: `1px solid ${SEV_COLOR[result.rules[rule] ?? 'info']}`, color: SEV_COLOR[result.rules[rule] ?? 'info'] }} data-testid="check-count" data-rule={rule}>
            {t(`check.rule.${rule}`)} {n}
          </span>
        ))}
        {result.disabled.length > 0 && <span className="text-muted">{t('check.disabled', { rules: result.disabled.join(', ') })}</span>}
        <span className="ml-auto inline-flex gap-1">
          {unpinned.length > 0 && <SmallBtn onClick={onFixAll}>{t('check.fix_all')} ({unpinned.length})</SmallBtn>}
          <SmallBtn onClick={onClose}>{t('check.close')}</SmallBtn>
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {[...bySlide.entries()].map(([slideIndex, list]) => (
            <li key={slideIndex}>
              <button type="button" className="text-muted font-medium hover:text-text bg-transparent border-0 cursor-pointer px-0" onClick={() => onJump(slideIndex)}>
                {slideIndex + 1}. {list[0].slideFile}
              </button>
              <ul className="ml-3 flex flex-col gap-0.5">
                {list.map((i) => {
                  const key = issueKey(i)
                  const done = pinned.has(key)
                  return (
                    <li key={key} className="flex items-start gap-2" data-testid="check-issue" data-rule={i.rule} data-severity={i.severity} data-pinned={done ? 'true' : 'false'}>
                      <span className="flex-none rounded-sm px-1" style={{ color: SEV_COLOR[i.severity], border: `1px solid ${SEV_COLOR[i.severity]}` }}>
                        {t(`check.rule.${i.rule}`)}
                      </span>
                      <span className="flex-1 min-w-0 text-muted">
                        <span className="text-text">{i.tag}{i.classes.length ? '.' + i.classes.slice(0, 2).join('.') : ''}</span>
                        {i.text ? ` "${i.text.length > 60 ? i.text.slice(0, 57) + '...' : i.text}"` : ''}
                        {i.detail ? ` · ${i.detail}` : ''}
                      </span>
                      <SmallBtn onClick={() => onFix(i)} disabled={done} title={t('check.fix')}>
                        {done ? '✓' : t('check.fix')}
                      </SmallBtn>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
