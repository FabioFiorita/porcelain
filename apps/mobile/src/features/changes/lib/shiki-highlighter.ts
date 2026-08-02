import type { LanguageInput, ThemeInput } from '@shikijs/core'
import { createHighlighterCore } from '@shikijs/core'
import { requireOptionalNativeModule } from 'expo'

import type { ShikiHighlighter } from '@/features/changes/lib/highlight'

/**
 * The bounded grammar set this client ships, mirroring the desktop renderer's `LANGS` choice
 * (apps/desktop/src/renderer/src/lib/highlight.ts) so both clients highlight the same languages.
 * Each entry is a dynamic import rather than a static one at module scope: the grammar is only
 * evaluated once `getHighlighter` actually runs, not merely because this file loaded.
 */
const LANG_LOADERS: LanguageInput[] = [
  (): Promise<typeof import('@shikijs/langs/typescript')> => import('@shikijs/langs/typescript'),
  (): Promise<typeof import('@shikijs/langs/tsx')> => import('@shikijs/langs/tsx'),
  (): Promise<typeof import('@shikijs/langs/javascript')> => import('@shikijs/langs/javascript'),
  (): Promise<typeof import('@shikijs/langs/jsx')> => import('@shikijs/langs/jsx'),
  (): Promise<typeof import('@shikijs/langs/json')> => import('@shikijs/langs/json'),
  (): Promise<typeof import('@shikijs/langs/css')> => import('@shikijs/langs/css'),
  (): Promise<typeof import('@shikijs/langs/html')> => import('@shikijs/langs/html'),
  (): Promise<typeof import('@shikijs/langs/markdown')> => import('@shikijs/langs/markdown'),
  (): Promise<typeof import('@shikijs/langs/yaml')> => import('@shikijs/langs/yaml'),
  (): Promise<typeof import('@shikijs/langs/shellscript')> => import('@shikijs/langs/shellscript'),
  (): Promise<typeof import('@shikijs/langs/swift')> => import('@shikijs/langs/swift'),
  (): Promise<typeof import('@shikijs/langs/dotenv')> => import('@shikijs/langs/dotenv'),
]

const THEME_LOADERS: Record<'dark' | 'light', ThemeInput> = {
  dark: (): Promise<typeof import('@shikijs/themes/dark-plus')> =>
    import('@shikijs/themes/dark-plus'),
  light: (): Promise<typeof import('@shikijs/themes/light-plus')> =>
    import('@shikijs/themes/light-plus'),
}

/** The shiki theme name for a resolved appearance, matching the desktop renderer's pair. */
export function shikiThemeName(scheme: 'light' | 'dark'): string {
  return scheme === 'dark' ? 'dark-plus' : 'light-plus'
}

let highlighterPromise: Promise<ShikiHighlighter> | null = null

type NativeShikiEngine = typeof import('react-native-shiki-engine')

async function loadNativeEngine(): Promise<NativeShikiEngine> {
  if (requireOptionalNativeModule('ShikiEngine') === null) {
    throw new Error('ShikiEngine is not linked in this native client.')
  }
  return await import('react-native-shiki-engine')
}

/**
 * A failed build (a bad OTA bundle split, a missing grammar chunk) must not wedge every future
 * mount behind the same rejected promise — clear the cache so the next caller retries from
 * scratch instead of awaiting a permanently-broken singleton.
 */
async function buildHighlighter(): Promise<ShikiHighlighter> {
  try {
    const nativeEngine = await loadNativeEngine()
    return (await createHighlighterCore({
      engine: nativeEngine.createNativeEngine(),
      langs: LANG_LOADERS,
      themes: [THEME_LOADERS.dark, THEME_LOADERS.light],
    })) as ShikiHighlighter
  } catch (error) {
    highlighterPromise = null
    throw error
  }
}

/**
 * One highlighter instance for the app's lifetime, built on first use: the native engine's own
 * guidance is to construct it once and reuse it, never per render. Returns `undefined` when the
 * native engine isn't linked — an old dev-client build, or a RowCanvas fallback build — so a
 * caller degrades to `highlight.ts`'s documented "no tokenizer" path, not a broken one.
 */
export function getHighlighter(): Promise<ShikiHighlighter> | undefined {
  highlighterPromise ??= buildHighlighter()
  return highlighterPromise
}
