import { ArrowUpIcon, FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { connectionErrorMessage } from '@/features/access/index';
import type { useProjectFolder } from '../queries/project-locations';
import { useProjectBrowserStore } from '../store';

export function ProjectFolderList({
  folder,
  disabled,
}: {
  folder: ReturnType<typeof useProjectFolder>;
  disabled: boolean;
}) {
  const setPath = useProjectBrowserStore((state) => state.setFolderPath);
  const current = folder.data;
  return (
    <ScrollArea className="h-40" aria-label="Folders">
      <div className="flex flex-col p-1">
        {folder.isPending ? (
          <p role="status" className="p-2 text-xs text-muted-foreground">
            Loading folders…
          </p>
        ) : folder.error ? (
          <div className="flex flex-col items-start gap-2 p-2">
            <p role="alert" className="text-xs text-destructive">
              {connectionErrorMessage(folder.error)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => void folder.refetch()}
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
        ) : (
          current && (
            <>
              {current.parent && (
                <Button
                  variant="ghost"
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
                <p className="p-2 text-xs text-muted-foreground">
                  No subfolders.
                </p>
              )}
            </>
          )
        )}
      </div>
    </ScrollArea>
  );
}
