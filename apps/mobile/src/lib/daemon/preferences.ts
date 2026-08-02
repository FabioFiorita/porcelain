import { useCallback } from 'react'
import { z } from 'zod'

import { setPreference, usePreferences } from '@/lib/preferences'

const terminalFontSizeSchema = z.union([z.literal(10), z.literal(12), z.literal(14)])

/** Device-local preference seam for feature-owned namespaced values. */
export function usePreference<T>(
  _key: 'terminal.fontSize',
  schema: z.ZodType<T>,
  fallback: T,
): readonly [T, (next: T) => void] {
  const preferences = usePreferences()
  const parsed = schema.safeParse(preferences.terminalFontSize)
  const set = useCallback((next: T): void => {
    const value = terminalFontSizeSchema.safeParse(next)
    if (value.success) setPreference('terminalFontSize', value.data)
  }, [])
  return [parsed.success ? parsed.data : fallback, set]
}
