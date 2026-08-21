import { ReadAllView } from '@/features/diff/read-all-view'
import type { ChangesScope } from './changes-store'
import { readingScopeFor } from './use-changes'

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
  return (
    <ReadAllView
      active={active}
      context={scope === 'branch' ? `Branch range · vs ${base ?? 'base'}` : 'Working tree'}
      scope={readingScopeFor(scope)}
      testID="porcelain-changes-read-all"
      title="All changes"
      onBack={onBack}
    />
  )
}
