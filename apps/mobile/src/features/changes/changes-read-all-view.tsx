import { ReadAllView } from '@/features/diff/read-all-view'
import type { ChangesScope } from './changes-store'
import { readingScopeFor, useReviewedPaths, useToggleReviewed } from './use-changes'

/**
 * The Changes tab's binding of the continuous read: the active scope's whole change set,
 * with the per-file reviewed ticks that let a read be walked off one file at a time.
 */
export function ChangesReadAllView({
  active,
  base,
  onBack,
  scope,
  topInset = 0,
}: {
  active: boolean
  base: string | undefined
  onBack?: () => void
  scope: ChangesScope
  topInset?: number
}): React.JSX.Element {
  const reviewedPaths = useReviewedPaths(active)
  const { mark, unmark } = useToggleReviewed()

  return (
    <ReadAllView
      active={active}
      context={scope === 'branch' ? `Branch range · vs ${base ?? 'base'}` : 'Working tree'}
      reviewed={{
        // mark/unmark are total void (React Query owns error + pending).
        onToggle: (path, next) => {
          if (next) mark(path)
          else unmark(path)
        },
        paths: reviewedPaths,
      }}
      scope={readingScopeFor(scope)}
      testID="porcelain-changes-read-all"
      title="All changes"
      topInset={topInset}
      onBack={onBack}
    />
  )
}
