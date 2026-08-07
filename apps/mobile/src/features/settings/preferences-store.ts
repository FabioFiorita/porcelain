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
export type TerminalTextSize = 'small' | 'medium' | 'large'

const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  diffMode: z.enum(['unified', 'split']),
  markdownMode: z.enum(['reader', 'source']),
  htmlMode: z.enum(['preview', 'source']),
  pullMode: z.enum(['merge', 'rebase']),
  commitModel: z.string().trim().min(1),
  terminalTextSize: z.enum(['small', 'medium', 'large']),
})

type Preferences = z.infer<typeof preferencesSchema>

const DEFAULTS: Preferences = {
  theme: 'system',
  diffMode: 'unified',
  markdownMode: 'reader',
  htmlMode: 'preview',
  pullMode: 'merge',
  commitModel: 'luna',
  // 12pt (the old fixed size) reads as unreadably small on a phone; 'medium' is the floor
  // for prose-heavy CLI output, not just code.
  terminalTextSize: 'medium',
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
  setTerminalTextSize: (size: TerminalTextSize) => void
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
    terminalTextSize: state.terminalTextSize,
  }
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => {
  /**
   * Write-through, but never before `hydrate` has landed.
   *
   * The store opens on `DEFAULTS` and fills in from SecureStore asynchronously, so a write in
   * that window would persist a whole blob of defaults over preferences the reader actually
   * set — one setter dragging the other five back to factory. Every setter goes through here;
   * `setTheme` used to be the only one that remembered.
   */
  const save = (): void => {
    if (!get().hydrated) return
    persist(slicePrefs(get())).catch(() => {
      // A preference is a convenience, not a credential: a failed write is not worth a dialog,
      // and the value is already live in memory for this session.
    })
  }

  return {
    ...DEFAULTS,
    hydrated: false,
    setTheme: (theme) => {
      applyTheme(theme)
      // Always write theme even when re-applying the same value (system OS flip).
      set({ theme })
      save()
    },
    setDiffMode: (diffMode) => {
      set({ diffMode })
      save()
    },
    setMarkdownMode: (markdownMode) => {
      set({ markdownMode })
      save()
    },
    setHtmlMode: (htmlMode) => {
      set({ htmlMode })
      save()
    },
    setPullMode: (pullMode) => {
      set({ pullMode })
      save()
    },
    setCommitModel: (commitModel) => {
      set({ commitModel })
      save()
    },
    setTerminalTextSize: (terminalTextSize) => {
      set({ terminalTextSize })
      save()
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
  }
})
