import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ArrowUpIcon, FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { useProjectFolder } from '../queries/project-locations';
import { projectFolder } from '../store';
import { useAtomSet } from '@effect/atom-react';

export function ProjectFolderList({
  folder,
  disabled,
}: {
  folder: ReturnType<typeof useProjectFolder>;
  disabled: boolean;
}) {
  return (
    <ScrollArea className="h-40" aria-label="Folders">
      <div className="flex flex-col p-1">
        <FolderEntries folder={folder} disabled={disabled} />
      </div>
    </ScrollArea>
  );
}

function FolderEntries({
  folder,
  disabled,
}: {
  folder: ReturnType<typeof useProjectFolder>;
  disabled: boolean;
}) {
  const setPath = useAtomSet(projectFolder);
  const current = Option.getOrUndefined(AsyncResult.value(folder.value));
  if (AsyncResult.isInitial(folder.value))
    return (
      <p role="status" className="px-2 py-1.5 text-xs text-muted-foreground">
        Loading folders…
      </p>
    );
  if (AsyncResult.isFailure(folder.value))
    return (
      <div className="flex flex-col items-start gap-2 px-2 py-1.5">
        <p role="alert" className="text-xs text-destructive">
          {connectionErrorMessage(Cause.squash(folder.value.cause))}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={folder.refresh}
            disabled={disabled}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setPath(undefined)}
            disabled={disabled}
          >
            Home folder
          </Button>
        </div>
      </div>
    );
  if (!current) return null;
  return (
    <>
      {current.parent && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setPath(current.parent ?? undefined)}
          disabled={disabled}
        >
          <ArrowUpIcon data-icon="inline-start" />
          Up
        </Button>
      )}
      {current.directories.map((directory) => (
        <Button
          key={directory.path}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          title={directory.path}
          onClick={() => setPath(directory.path)}
          disabled={disabled}
        >
          <FolderIcon data-icon="inline-start" />
          <span className="truncate">{directory.name}</span>
        </Button>
      ))}
      {!current.directories.length && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          No subfolders.
        </p>
      )}
    </>
  );
}
