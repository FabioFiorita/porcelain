import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  projectUnavailableMessage,
  type Project,
} from '@porcelain/client/projects/rules';
import { projectFolder } from '../store';
import { useAtomSet } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
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
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  useResetProjectBrowser,
  useOpenProject,
} from '../commands/open-project';
import { openProjectDialog } from '../overlays';
import type { WorktreeTarget } from '../rules/worktree-target';
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
  const resetProjectBrowser = useResetProjectBrowser();
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
                key={`${payload.remote}:${payload.project?.id ?? 'open'}`}
                connection={target.connection}
                remote={payload.remote}
                name={target.name}
                onOpened={onOpened}
                project={payload.project}
                path={payload.path}
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
  project,
  path,
}: {
  connection: Connection;
  remote: string | null;
  name: string | undefined;
  onOpened: Opened;
  project: Project | undefined;
  path: string | undefined;
}) {
  const [recovery, setRecovery] = useState(
    project ? { project, path } : undefined,
  );
  const setFolder = useAtomSet(projectFolder);
  const opening = useOpenProject(
    connection,
    remote,
    () => openProjectDialog.close(),
    onOpened,
    (project, path) => setRecovery({ project, path }),
    recovery?.project.id,
  );
  return (
    <>
      <DialogHeader className="shrink-0 flex-row items-center text-left">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <FolderGit2Icon aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle>
            {recovery ? `Reconnect ${recovery.project.name}` : 'Open project'}
          </DialogTitle>
          <DialogDescription>
            {name === undefined
              ? 'Browse for a repository on the Porcelain server.'
              : `Browse for a repository on ${name}.`}
          </DialogDescription>
        </div>
      </DialogHeader>
      <ScrollArea className="min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90svh-8rem)]">
        <div className="flex flex-col gap-3">
          {recovery && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {projectUnavailableMessage(recovery.project)}
              </p>
              <p className="text-sm text-muted-foreground">
                Reconnect only a repository you trust as the replacement for{' '}
                {recovery.project.name}. The project and saved history stay in
                Porcelain. Replacement worktrees start with fresh review marks
                and Walkthroughs; old records are not applied to them.
              </p>
              {recovery.path && (
                <>
                  <p className="text-sm wrap-anywhere">{recovery.path}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={opening.result.waiting}
                      onClick={() => {
                        if (recovery.path) void opening.submit(recovery.path);
                      }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="outline"
                      disabled={opening.result.waiting}
                      onClick={() => {
                        setFolder(recovery.path);
                        setRecovery({ ...recovery, path: undefined });
                      }}
                    >
                      Choose folder
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          {!recovery?.path && (
            <ProjectFolderPicker
              disabled={opening.result.waiting}
              connection={connection}
              onOpen={(path) => {
                if (recovery) setRecovery({ ...recovery, path });
                else void opening.submit(path);
              }}
              action={recovery ? 'Choose folder' : undefined}
            />
          )}
          {AsyncResult.isFailure(opening.result) && (
            <Alert variant="destructive">
              <AlertDescription>
                {connectionErrorMessage(Cause.squash(opening.result.cause))}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
