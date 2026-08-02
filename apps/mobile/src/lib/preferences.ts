import Storage from 'expo-sqlite/kv-store'
import { create } from 'zustand'

/**
 * Reading preferences, mirroring the renderer's General settings so a file reads the same
 * on both clients. Appearance is not here on purpose — the app follows the phone.
 */
export type Preferences = {
  diffLayout: 'unified' | 'split'
  html: 'preview' | 'source'
  markdown: 'reader' | 'source'
  pullMode: 'merge' | 'rebase'
  terminalFontSize: TerminalFontSize
}

const TERMINAL_FONT_SIZES = [10, 12, 14] as const
type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number]

const DEFAULTS: Preferences = {
  diffLayout: 'unified',
  html: 'preview',
  markdown: 'reader',
  pullMode: 'merge',
  terminalFontSize: 12,
}

const ALLOWED: { [K in keyof Preferences]: readonly Preferences[K][] } = {
  diffLayout: ['unified', 'split'],
  html: ['preview', 'source'],
  markdown: ['reader', 'source'],
  pullMode: ['merge', 'rebase'],
  terminalFontSize: TERMINAL_FONT_SIZES,
}

// One blob under one key: these are read together and never written from two places at once.
const STORAGE_KEY = 'porcelain.preferences'

function narrow<K extends keyof Preferences>(key: K, value: unknown): Preferences[K] {
  return ALLOWED[key].find((allowed) => allowed === value) ?? DEFAULTS[key]
}

/**
 * `expo-sqlite/kv-store` reads synchronously, so the first paint already has the stored value —
 * no flash of defaults for three enum rows. This runs at module scope, so every failure has to
 * fall back rather than throw: the first read opens the database and can fail on a corrupt file
 * or under iOS data protection, and a throw here would take the whole import graph down.
 */
function readStored(): Preferences {
  let raw: string | null
  try {
    raw = Storage.getItemSync(STORAGE_KEY)
  } catch {
    return DEFAULTS
  }
  if (raw === null) return DEFAULTS

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULTS
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULTS

  const stored: Record<string, unknown> = { ...parsed }
  return {
    diffLayout: narrow('diffLayout', stored.diffLayout),
    html: narrow('html', stored.html),
    markdown: narrow('markdown', stored.markdown),
    pullMode: narrow('pullMode', stored.pullMode),
    terminalFontSize: narrow('terminalFontSize', stored.terminalFontSize),
  }
}

const usePreferencesStore = create<Preferences>()(() => readStored())

export function usePreferences(): Preferences {
  return usePreferencesStore()
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  const next: Preferences = { ...usePreferencesStore.getState() }
  next[key] = value
  usePreferencesStore.setState(next)
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The control already moved; a failed write costs the choice at next launch, not the tap.
  }
}
