import { useConnectedContext } from '@/features/access/index';
import { Fragment, useState } from 'react';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { KeyboardIcon, MonitorIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useElement } from '@/shared/hooks/use-element';
import { Input } from '@/components/ui/input';
import {
  WorkspaceSearchResults,
  RemoteWorkspaceSearch,
} from './workspace-search-results';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarMenuSubItem } from '@/components/ui/sidebar';
import type { RemoteConnection } from '@porcelain/client/access';
import type { WorktreeTarget } from '../rules/worktree-target';
import type { Inventory } from '@porcelain/client/projects/rules';
import { MachineSection } from './machine-section';
import { NavigatorHeader } from './navigator-header';
import { OpenProjectMenu } from './open-project-menu';
import { RemoteMachine } from './remote-machine';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { ProjectSection } from './project-section';

type Props = {
  inventory: Inventory;
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onRetry: () => void;
  onSelect: (target: WorktreeTarget) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenRemotes: (environmentId: string) => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  inventory,
  onRetry,
  remotes,
  selected,
  onSelect: select,
  onOpenProject,
  onOpenSettings: openSettings,
  onOpenRemotes: openRemotes,
  onOpenShortcuts: openShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const { element: searchInput, attach: attachSearchInput } =
    useElement<HTMLInputElement>();
  const { element: results, attach: attachResults } =
    useElement<HTMLDivElement>();
  const clearSearch = () => {
    setQuery('');
    searchInput?.focus();
  };
  const projects = inventory.projects;
  const selectedOn = (remote: string | null) =>
    selected?.remote === remote ? selected.worktreeId : undefined;
  const empty = (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No projects registered</EmptyTitle>
        <EmptyDescription>
          This environment has no projects yet.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
  const section = (project: Inventory['projects'][number]) => (
    <ProjectSection
      environmentId={null}
      connection={connection}
      project={project}
      onRetry={onRetry}
      selected={selectedOn(null)}
      onSelect={(worktreeId) =>
        select({ remote: null, projectId: project.id, worktreeId })
      }
    />
  );
  const localProjects =
    projects.length === 0
      ? empty
      : projects.map((project) => (
          <Fragment key={project.id}>{section(project)}</Fragment>
        ));

  return (
    <nav
      aria-label="Projects and worktrees"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-ui"
    >
      <NavigatorHeader environment={inventory.environment.name}>
        <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
      </NavigatorHeader>

      <div className="flex items-center gap-1 border-b p-2">
        <Input
          ref={attachSearchInput}
          type="search"
          aria-label="Search projects and worktrees"
          placeholder="Search workspaces…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              event.stopPropagation();
              clearSearch();
            }
            if (
              searching &&
              (event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Enter')
            ) {
              event.preventDefault();
              const rows = results?.querySelectorAll<HTMLButtonElement>(
                'button[data-workspace-result]:not(:disabled)',
              );
              const row =
                event.key === 'ArrowUp' ? rows?.[rows.length - 1] : rows?.[0];
              if (event.key === 'Enter') row?.click();
              else row?.focus();
            }
          }}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            title="Clear search"
            onClick={clearSearch}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <ScrollArea className="h-0 min-h-0 flex-1">
        {searching && (
          <div
            ref={attachResults}
            role="region"
            aria-label="Workspace search results"
            className="p-2"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                clearSearch();
              }
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
              const rows = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button[data-workspace-result]:not(:disabled)',
                ),
              );
              const index = rows.findIndex((row) => row === event.target);
              if (index < 0) return;
              event.preventDefault();
              const next = index + (event.key === 'ArrowDown' ? 1 : -1);
              if (next < 0) searchInput?.focus();
              else rows[next]?.focus();
            }}
          >
            <h2 className="px-2 py-1 text-caption text-muted-foreground">
              {inventory.environment.name} · This computer
            </h2>
            <WorkspaceSearchResults
              inventory={inventory}
              remote={null}
              query={query}
              selected={selected}
              onSelect={select}
            />
            {remotes?.map((entry) => (
              <RemoteWorkspaceSearch
                key={entry.remote.environmentId}
                entry={entry}
                query={query}
                selected={selected}
                onSelect={select}
                onOpenRemotes={() => openRemotes(entry.remote.environmentId)}
              />
            ))}
          </div>
        )}
        <div hidden={searching} className={remotes ? 'py-2 pr-2' : 'p-2'}>
          {remotes ? (
            <>
              <MachineSection
                environmentId={null}
                name="This computer"
                icon={MonitorIcon}
              >
                {projects.length === 0 ? (
                  <SidebarMenuSubItem>{empty}</SidebarMenuSubItem>
                ) : (
                  projects.map((project) => (
                    <SidebarMenuSubItem key={project.id}>
                      {section(project)}
                    </SidebarMenuSubItem>
                  ))
                )}
              </MachineSection>
              {remotes.map((entry) => (
                <RemoteMachine
                  key={entry.remote.environmentId}
                  entry={entry}
                  selected={selectedOn(entry.remote.environmentId)}
                  onSelect={select}
                  onOpenRemotes={() => openRemotes(entry.remote.environmentId)}
                />
              ))}
            </>
          ) : (
            localProjects
          )}
        </div>
      </ScrollArea>

      <footer className="flex shrink-0 items-center gap-1 border-t p-2">
        <Button
          variant="ghost"
          className="h-8 min-w-0 flex-1 justify-start"
          aria-keyshortcuts={SHORTCUTS.openSettings}
          title={`Settings (${formatForDisplay(SHORTCUTS.openSettings)})`}
          onClick={openSettings}
        >
          <SettingsIcon className="size-3.5" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts={SHORTCUTS.openShortcuts}
          title={`Keyboard shortcuts (${formatForDisplay(SHORTCUTS.openShortcuts)})`}
          onClick={openShortcuts}
        >
          <KeyboardIcon />
        </Button>
      </footer>
    </nav>
  );
}
