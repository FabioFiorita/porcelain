import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Connection } from '@/shared/workspace/connection';
import { walkthroughSettingsDialog } from '../overlays';
import { ProjectOwner } from './project-owner';
import { WalkthroughWriterForm } from '@/features/preferences/index';
export function WalkthroughSettingsDialog({
  connection,
}: {
  connection: Connection;
}) {
  return (
    <DialogPrimitive.Root handle={walkthroughSettingsDialog}>
      {({ payload }) =>
        payload && (
          <ProjectOwner remote={payload.remote} connection={connection}>
            {(owner) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Walkthroughs for {payload.project.name}
                  </DialogTitle>
                  <DialogDescription>
                    Use the default writer or override it for this project. This
                    choice applies to manual and automatic walkthroughs and
                    their answers.
                  </DialogDescription>
                </DialogHeader>
                <WalkthroughWriterForm
                  key={payload.project.id}
                  project={payload.project}
                  {...owner}
                  onSaved={() => walkthroughSettingsDialog.close()}
                />
              </DialogContent>
            )}
          </ProjectOwner>
        )
      }
    </DialogPrimitive.Root>
  );
}
