import { useCallback, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
interface Prefs { theme: Theme; basis: 'fy' | 'calendar'; lastBackup: string }

export function loadPref<K extends keyof Prefs>(key: K, fallback: Prefs[K]): Prefs[K] {
  try {
    const v = localStorage.getItem(`pl-${key}`)
    return v === null ? fallback : (v as Prefs[K])
  } catch {
    return fallback
  }
}
export function savePref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  try { localStorage.setItem(`pl-${key}`, value) } catch { /* storage blocked: preference lasts for this visit only */ }
}

export function usePref<K extends keyof Prefs>(key: K, fallback: Prefs[K]): [Prefs[K], (v: Prefs[K]) => void] {
  const [value, setValue] = useState<Prefs[K]>(() => loadPref(key, fallback))
  const set = useCallback((v: Prefs[K]) => { setValue(v); savePref(key, v); if (key === 'theme') applyTheme(v as Theme) }, [key])
  return [value, set]
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.mode = dark ? 'dark' : 'light'
}
