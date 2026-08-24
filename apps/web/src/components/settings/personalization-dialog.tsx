import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { usePersonalizationStore } from '@renderer/stores/personalization'
import { TestIds } from '@shared/test-ids'
import { PersonalizationSection } from './personalization-section'

/**
 * One Project's pins, hides, and story order, raised from its row in the sidebar tree.
 */
export function PersonalizationDialog(): React.JSX.Element {
  const target = usePersonalizationStore((state) => state.target)
  const close = usePersonalizationStore((state) => state.close)

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open: boolean): void => {
        if (!open) close()
      }}
    >
      <DialogContent data-testid={TestIds.hubPersonalizationDialog} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalization</DialogTitle>
          <DialogDescription>
            {target === null
              ? ''
              : `What ${target.projectName} pins, hides, and the order its changes read in.`}
          </DialogDescription>
        </DialogHeader>
        {target !== null && (
          <PersonalizationSection
            repoPath={target.projectPath}
            environmentId={target.environmentId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
