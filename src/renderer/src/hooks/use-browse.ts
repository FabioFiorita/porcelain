import type { BrowseResult } from '@backend/browse'
import { trpc } from '@renderer/lib/trpc'
import { keepPreviousData } from '@tanstack/react-query'

/**
 * Browse the daemon's directories for the repo picker. `path` null = the daemon home.
 * No repo-gating — this runs from the welcome screen (repo null). `keepPreviousData`
 * keeps the current listing on screen while navigating so rows don't flash to empty;
 * the query's error surfaces the unreadable/missing-path message to the dialog.
 */
export function useBrowseDirs(
  path: string | null,
  enabled: boolean,
): {
  result: BrowseResult | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const {
    data: result,
    error,
    isFetching,
  } = trpc.browseDirs.useQuery(path, { enabled, placeholderData: keepPreviousData })
  return { result, error, isFetching }
}
