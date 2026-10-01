import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { FolderGit2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { connectionErrorMessage } from '@/features/access/index';
import { useOpenProject } from '../commands/open-project';
import { openProjectDialog } from '../overlays';
import { ProjectDiscovery } from './project-discovery';
import { ProjectFolderPicker } from './project-folder-picker';
import { type Connection } from '@/shared/workspace/connection';

export function OpenProjectDialog({
  connection,
  onOpened,
}: {
  connection: Connection;
  onOpened: (projectId: string, worktreeId: string) => Promise<void>;
}) {
  const opening = useOpenProject(
    connection,
    () => openProjectDialog.close(),
    onOpened,
  );
  return (
    <DialogPrimitive.Root
      handle={openProjectDialog}
      onOpenChangeComplete={opening.onCloseChange}
    >
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0 flex-row items-center text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <FolderGit2Icon aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>Open project</DialogTitle>
            <DialogDescription>
              Find a repository on the Porcelain server.
            </DialogDescription>
          </div>
        </DialogHeader>
        <ScrollArea className="min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90svh-8rem)]">
          <div className="flex flex-col gap-3 p-1">
            <ProjectDiscovery
              disabled={opening.isPending}
              connection={connection}
              onOpen={(path) => void opening.submit(path)}
            />
            <ProjectFolderPicker
              disabled={opening.isPending}
              connection={connection}
              onOpen={(path) => void opening.submit(path)}
            />
            {opening.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {connectionErrorMessage(opening.error)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}
