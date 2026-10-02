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
import {
  connectionErrorMessage,
  type RemoteConnection,
} from '@/features/access/index';
import { resetProjectBrowser, useOpenProject } from '../commands/open-project';
import { openProjectDialog } from '../overlays';
import type { WorktreeTarget } from '../rules/inventory';
import { ProjectFolderPicker } from './project-folder-picker';
import { type Connection } from '@/shared/workspace/connection';

type Opened = (target: WorktreeTarget) => Promise<void>;

export function OpenProjectDialog({
  connection,
  remotes,
  onOpened,
}: {
  connection: Connection;
  remotes: readonly RemoteConnection[];
  onOpened: Opened;
}) {
  const computer = (remote: string | null) => {
    if (remote === null) return { connection, name: undefined };
    const entry = remotes.find((each) => each.remote.environmentId === remote);
    return entry && { connection: entry.connection, name: entry.remote.name };
  };
  return (
    <DialogPrimitive.Root
      handle={openProjectDialog}
      onOpenChangeComplete={resetProjectBrowser}
    >
      {({ payload }) => {
        const target = payload && computer(payload.remote);
        return (
          payload &&
          target && (
            <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
              <OpenProjectContent
                key={payload.remote}
                connection={target.connection}
                remote={payload.remote}
                name={target.name}
                onOpened={onOpened}
              />
            </DialogContent>
          )
        );
      }}
    </DialogPrimitive.Root>
  );
}

function OpenProjectContent({
  connection,
  remote,
  name,
  onOpened,
}: {
  connection: Connection;
  remote: string | null;
  name: string | undefined;
  onOpened: Opened;
}) {
  const opening = useOpenProject(
    connection,
    remote,
    () => openProjectDialog.close(),
    onOpened,
  );
  return (
    <>
      <DialogHeader className="shrink-0 flex-row items-center text-left">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <FolderGit2Icon aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle>Open project</DialogTitle>
          <DialogDescription>
            {name === undefined
              ? 'Browse for a repository on the Porcelain server.'
              : `Browse for a repository on ${name}.`}
          </DialogDescription>
        </div>
      </DialogHeader>
      <ScrollArea className="min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90svh-8rem)]">
        <div className="flex flex-col gap-3 p-1">
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
    </>
  );
}
