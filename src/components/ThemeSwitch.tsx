import type { ReactNode } from 'react'
import { usePref, type Theme } from '../prefs'
import { Tooltip } from './Tooltip'

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </svg>
)
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" />
  </svg>
)
const AutoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="12" height="8.5" rx="1.5" /><path d="M6 14h4M8 11.5V14" />
  </svg>
)

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'Match system', icon: <AutoIcon /> },
]

/** Light / dark / system switch shown in the app shell. Choice is remembered on this device. */
export function ThemeSwitch() {
  const [theme, setTheme] = usePref('theme', 'system' as Theme)
  return (
    <div role="group" aria-label="Theme" className="theme-switch">
      {OPTIONS.map((o) => (
        <Tooltip key={o.value} content={o.label} side="bottom">
          <button type="button" className="theme-btn" aria-pressed={theme === o.value} aria-label={o.label} onClick={() => setTheme(o.value)}>
            {o.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
