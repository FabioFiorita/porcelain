import {
  ArrowUpIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { connectionErrorMessage } from '@/features/access/index';
import { useProjectFolder } from '../queries/project-locations';

export function ProjectFolderPicker({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [path, setPath] = useState<string>();
  const folder = useProjectFolder(path, expanded);
  const current = folder.data;
  const crumbs = current
    ? ['/', ...current.path.split('/').filter(Boolean)]
    : [];
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="group/folders"
    >
      <CollapsibleTrigger
        render={<Button variant="ghost" className="w-full justify-start" />}
      >
        <ChevronDownIcon className="transition-transform group-data-closed/folders:-rotate-90" />
        <FolderOpenIcon />
        Browse for a folder
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 p-2 pt-1">
          {current && (
            <Breadcrumb aria-label="Folder path">
              <BreadcrumbList>
                {crumbs.map((name, index) => {
                  const destination =
                    index === 0
                      ? '/'
                      : `/${crumbs.slice(1, index + 1).join('/')}`;
                  return (
                    <Fragment key={destination}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem className="min-w-0">
                        {index === crumbs.length - 1 ? (
                          <BreadcrumbPage
                            className="max-w-48"
                            title={current.path}
                          >
                            {name}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            render={
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => setPath(destination)}
                              />
                            }
                            title={destination}
                          >
                            {name}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          )}
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
          {current?.truncated && (
            <p className="px-1 text-xs text-muted-foreground">
              This folder is large; some entries are not shown. Enter a
              repository path below to open one directly.
            </p>
          )}
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">
              {current?.repository
                ? 'Every worktree appears in the sidebar.'
                : 'Pick a folder that is a Git repository.'}
            </p>
            <Button
              size="sm"
              disabled={
                disabled ||
                !current?.repository ||
                folder.isFetching ||
                folder.isError
              }
              onClick={() => {
                if (current) onOpen(current.path);
              }}
            >
              {disabled && <Spinner />}
              <span className="max-w-36 truncate">
                Open{' '}
                {current?.path.split('/').filter(Boolean).at(-1) ?? 'folder'}
              </span>
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
