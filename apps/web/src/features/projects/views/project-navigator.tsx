import { Fragment } from 'react';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { KeyboardIcon, MonitorIcon, SettingsIcon } from 'lucide-react';
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
import { OpenProjectMenu } from './open-project-menu';
import { RemoteMachine } from './remote-machine';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { ProjectSection } from './project-section';

type Props = {
  inventory: Inventory;
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenRemotes: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  inventory,
  remotes,
  selected,
  onSelect: select,
  onOpenProject,
  onOpenSettings: openSettings,
  onOpenRemotes: openRemotes,
  onOpenShortcuts: openShortcuts,
}: Props) {
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
      project={project}
      selected={selectedOn(null)}
      onSelect={(worktreeId) =>
        select({ remote: null, projectId: project.id, worktreeId })
      }
    />
  );

  return (
    <nav
      aria-label="Projects and worktrees"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-ui"
    >
      <header className="desktop-sidebar-header flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold">Porcelain</span>
          <span
            className="truncate text-2xs text-muted-foreground"
            title={`Connected to ${inventory.environment.name}`}
          >
            {inventory.environment.name}
          </span>
        </div>
        <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
      </header>

      <ScrollArea className="h-0 min-h-0 flex-1">
        <div className={remotes ? 'py-2 pr-2' : 'p-2'}>
          {remotes ? (
            <>
              <MachineSection name="This computer" icon={MonitorIcon}>
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
                  onOpenRemotes={openRemotes}
                />
              ))}
            </>
          ) : projects.length === 0 ? (
            empty
          ) : (
            projects.map((project) => (
              <Fragment key={project.id}>{section(project)}</Fragment>
            ))
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
