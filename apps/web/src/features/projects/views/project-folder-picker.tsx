import { PendingButton } from '@/shared/views/pending-button';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useProjectFolder } from '../queries/project-locations';
import { projectFolder } from '../store';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { ProjectFolderList } from './project-folder-list';
import { type Connection } from '@/shared/workspace/connection';

export function ProjectFolderPicker({
  connection,
  disabled,
  onOpen,
  action,
}: {
  connection: Connection;
  disabled: boolean;
  onOpen: (path: string) => void;
  action?: string | undefined;
}) {
  const path = useAtomValue(projectFolder);
  const setPath = useAtomSet(projectFolder);
  const folder = useProjectFolder(connection, path);
  const current = Option.getOrUndefined(AsyncResult.value(folder.value));
  const crumbs = current
    ? ['/', ...current.path.split('/').filter(Boolean)]
    : [];
  return (
    <section aria-label="Browse for a folder" className="flex flex-col gap-2">
      <div className="flex min-h-5 flex-col gap-1">
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
      </div>
      <ProjectFolderList folder={folder} disabled={disabled} />
      {current?.truncated && (
        <p className="text-xs text-muted-foreground">
          This folder is large; some entries are not shown.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {current?.repository
            ? 'Every worktree appears in the sidebar.'
            : 'Pick a folder that is a Git repository.'}
        </p>
        <PendingButton
          pending={disabled}
          size="sm"
          disabled={
            disabled ||
            !current?.repository ||
            AsyncResult.isWaiting(folder.value) ||
            AsyncResult.isFailure(folder.value)
          }
          onClick={() => {
            if (current) onOpen(current.path);
          }}
        >
          {action ?? 'Open repository'}
        </PendingButton>
      </div>
    </section>
  );
}
