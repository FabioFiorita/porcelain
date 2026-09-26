import type { ProjectConnection } from '../rules/connection';
import { ChevronDownIcon, FolderOpenIcon } from 'lucide-react';
import { Fragment } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { useProjectFolder } from '../queries/project-locations';
import { useProjectBrowserStore } from '../store';
import { ProjectFolderList } from './project-folder-list';

export function ProjectFolderPicker({
  connection,
  disabled,
  onOpen,
}: {
  connection: ProjectConnection | null;
  disabled: boolean;
  onOpen: (path: string) => void;
}) {
  const path = useProjectBrowserStore((state) => state.folderPath);
  const setPath = useProjectBrowserStore((state) => state.setFolderPath);
  const folder = useProjectFolder(connection, path, true);
  const current = folder.data;
  const crumbs = current
    ? ['/', ...current.path.split('/').filter(Boolean)]
    : [];
  return (
    <Collapsible defaultOpen className="group/folders">
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
          <ProjectFolderList folder={folder} disabled={disabled} />
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
