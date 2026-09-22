import { useCallback, useEffect, useMemo, useState } from 'react'
import en from './en.json'
import ko from './ko.json'

export type Locale = 'en' | 'ko'
export type LocalePref = 'auto' | Locale

const DICTS: Record<Locale, Record<string, string>> = { en, ko }
const STORAGE_KEY = 'html-studio.lang'
export const LOCALES: Locale[] = ['en', 'ko']

/** Resolve the effective locale: a manual override wins, otherwise follow the browser. */
export function resolveLocale(pref: LocalePref): Locale {
  if (pref !== 'auto') return pref
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en'
  return lang.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

function readPref(): LocalePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ko' || v === 'auto') return v
  } catch {
    /* storage unavailable */
  }
  return 'auto'
}

/** Translate a key; falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let text = DICTS[locale][key] ?? DICTS.en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}

export function useI18n() {
  const [pref, setPrefState] = useState<LocalePref>(readPref)

  // Follow browser language changes while in auto mode.
  const [, bump] = useState(0)
  useEffect(() => {
    const onChange = () => bump((n) => n + 1)
    window.addEventListener('languagechange', onChange)
    return () => window.removeEventListener('languagechange', onChange)
  }, [])

  const setPref = useCallback((next: LocalePref) => {
    setPrefState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const locale = resolveLocale(pref)
  const t = useMemo(
    () => (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )
  return { t, locale, pref, setPref }
}
