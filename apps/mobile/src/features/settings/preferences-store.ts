import type { CommitModel } from '@porcelain/contracts'
import * as SecureStore from 'expo-secure-store'
import { Appearance, type ColorSchemeName } from 'react-native'
import { colorScheme as cssColorScheme } from 'react-native-css/native'
import { z } from 'zod'
import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'
export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'
export type HtmlMode = 'preview' | 'source'
export type PullMode = 'merge' | 'rebase'

const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  diffMode: z.enum(['unified', 'split']),
  markdownMode: z.enum(['reader', 'source']),
  htmlMode: z.enum(['preview', 'source']),
  pullMode: z.enum(['merge', 'rebase']),
  commitModel: z.string().trim().min(1),
})

type Preferences = z.infer<typeof preferencesSchema>

const DEFAULTS: Preferences = {
  theme: 'system',
  diffMode: 'unified',
  markdownMode: 'reader',
  htmlMode: 'preview',
  pullMode: 'merge',
  commitModel: 'luna',
}

const STORAGE_KEY = 'porcelain.preferences'

/**
 * Drive both RN Appearance (nav/status bar + useColorScheme) and react-native-css's
 * colorScheme observable (what `@media (prefers-color-scheme: dark)` in tokens.css
 * actually reads). Appearance alone does not update NativeWind CSS variables.
 */
/** Sync RN Appearance + react-native-css colorScheme to a preference. */
export function applyTheme(theme: ThemeMode): void {
  if (theme === 'system') {
    // Restore OS preference for Appearance listeners, then sync the CSS observable.
    Appearance.setColorScheme('unspecified')
    const os = Appearance.getColorScheme()
    cssColorScheme.set(os === 'dark' ? 'dark' : 'light')
    return
  }
  Appearance.setColorScheme(theme satisfies ColorSchemeName)
  cssColorScheme.set(theme)
}

type PreferencesState = Preferences & {
  hydrated: boolean
  setTheme: (theme: ThemeMode) => void
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setHtmlMode: (mode: HtmlMode) => void
  setPullMode: (mode: PullMode) => void
  setCommitModel: (model: CommitModel) => void
  hydrate: () => Promise<void>
}

async function persist(state: Preferences): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state))
}

function slicePrefs(state: PreferencesState): Preferences {
  return {
    theme: state.theme,
    diffMode: state.diffMode,
    markdownMode: state.markdownMode,
    htmlMode: state.htmlMode,
    pullMode: state.pullMode,
    commitModel: state.commitModel,
  }
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  ...DEFAULTS,
  hydrated: false,
  setTheme: (theme) => {
    applyTheme(theme)
    // Always write theme even when re-applying the same value (system OS flip).
    set({ theme })
    if (get().hydrated) persist(slicePrefs(get()))
  },
  setDiffMode: (diffMode) => {
    set({ diffMode })
    persist(slicePrefs(get()))
  },
  setMarkdownMode: (markdownMode) => {
    set({ markdownMode })
    persist(slicePrefs(get()))
  },
  setHtmlMode: (htmlMode) => {
    set({ htmlMode })
    persist(slicePrefs(get()))
  },
  setPullMode: (pullMode) => {
    set({ pullMode })
    persist(slicePrefs(get()))
  },
  setCommitModel: (commitModel) => {
    set({ commitModel })
    persist(slicePrefs(get()))
  },
  hydrate: async () => {
    if (get().hydrated) return
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (raw !== null) {
        const parsed = preferencesSchema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          applyTheme(parsed.data.theme)
          set({ ...parsed.data, hydrated: true })
          return
        }
      }
    } catch {
      // Corrupted prefs fall through to defaults — not a credential.
    }
    applyTheme(DEFAULTS.theme)
    set({ hydrated: true })
  },
}))
