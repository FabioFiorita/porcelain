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

/** One Project's copyable story-order instruction, raised from its sidebar row. */
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
      <DialogContent
        data-testid={TestIds.hubPersonalizationDialog}
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Personalization</DialogTitle>
          <DialogDescription>
            {target === null
              ? ''
              : `Agent guidance for how ${target.projectName} changes should read.`}
          </DialogDescription>
        </DialogHeader>
        {target !== null && <PersonalizationSection repoPath={target.projectPath} />}
      </DialogContent>
    </Dialog>
  )
}
