import { useIsFocused, useRouter } from 'expo-router'

import { ChangesReadAllView } from '@/features/changes/changes-read-all-view'
import { useChangesStore } from '@/features/changes/changes-store'
import { useChangesFlow } from '@/features/changes/use-changes'

/**
 * The whole change set as one continuous read, pushed over the Changes list.
 *
 * Scope stays in the store rather than the route: it is the tab's setting, not this screen's,
 * and the list behind us renders against the same value.
 */
export default function ChangesReadAllRoute(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const scope = useChangesStore((state) => state.scope)
  const { base } = useChangesFlow(focused)

  return (
    <ChangesReadAllView
      active={focused}
      base={base}
      scope={scope}
      onBack={() => {
        router.back()
      }}
    />
  )
}
