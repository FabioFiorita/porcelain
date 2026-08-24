import { EmptyNote } from '@/components/panel-chrome'
import { Sheet } from '@/components/ui/sheet'

import { usePersonalizationStore } from './personalization-store'

/**
 * One Project's pins, hides, and story order, raised from its name in the Hub list.
 *
 * Read-only is the feature on desktop too. Mobile has no reader for the profile yet, so this
 * names the Project and says so rather than showing an empty card that reads as a broken query.
 */
export function PersonalizationSheet(): React.JSX.Element {
  const target = usePersonalizationStore((state) => state.target)
  const close = usePersonalizationStore((state) => state.close)

  return (
    <Sheet
      description={
        target === null
          ? undefined
          : `What ${target.projectName} pins, hides, and the order its changes read in.`
      }
      open={target !== null}
      testID="porcelain-personalization-sheet"
      title="Personalization"
      onClose={close}
    >
      <EmptyNote
        body="The worktree profile — pinned paths, hidden paths, and story layer order — is set by your agent and shown read-only in the desktop client. Mobile has no reader for it yet."
        testID="porcelain-personalization-empty"
        title="Not on mobile yet"
      />
    </Sheet>
  )
}
