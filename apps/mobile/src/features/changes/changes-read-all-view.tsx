import { ReadAllView } from '@/features/diff/read-all-view'
import type { ChangesScope } from './changes-store'
import { readingScopeFor } from './use-changes'
import { useReviewed } from './reviewed-data'

/**
 * The Changes tab's binding of the continuous read: the active scope's whole change set,
 * with the per-file reviewed ticks that let a read be walked off one file at a time.
 */
export function ChangesReadAllView({
  active,
  base,
  onBack,
  scope,
}: {
  active: boolean
  base: string | undefined
  onBack?: () => void
  scope: ChangesScope
}): React.JSX.Element {
  const reviewScope =
    scope === 'branch' && base !== undefined
      ? { type: 'branch' as const, base }
      : { type: 'working' as const }
  const reviewed = useReviewed(reviewScope, active)
  return (
    <ReadAllView
      active={active}
      context={scope === 'branch' ? `Branch range · vs ${base ?? 'base'}` : 'Working tree'}
      scope={readingScopeFor(scope, base)}
      reviewed={reviewed}
      testID="porcelain-changes-read-all"
      title="All changes"
      onBack={onBack}
    />
  )
}
