import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  KeyboardIcon,
  MonitorIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRemoteConnections } from '@/features/access/index';
import { desktopShell } from '@/shared/shell';
import type { ProjectConnection } from '../rules/connection';
import type { Inventory, WorktreeTarget } from '../rules/inventory';
import { MachineSection } from './machine-section';
import { RemoteMachine } from './remote-machine';
import { RemoveProjectDialog } from './remove-project-dialog';
import { RenameProjectDialog } from './rename-project-dialog';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { ProjectSection } from './project-section';

type Props = {
  inventory: Inventory;
  connection: ProjectConnection;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenProject: () => void;
  onOpenSettings: () => void;
  onOpenRemotes: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  inventory,
  connection,
  selected,
  onSelect: select,
  onOpenProject: openProject,
  onOpenSettings: openSettings,
  onOpenRemotes: openRemotes,
  onOpenShortcuts: openShortcuts,
}: Props) {
  const projects = inventory.projects;
  const remotes = useRemoteConnections();
  const selectedOn = (remote: string | null) =>
    selected?.remote === remote ? selected.worktreeId : undefined;
  const local =
    projects.length === 0 ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No projects registered</EmptyTitle>
          <EmptyDescription>
            This environment has no projects yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      projects.map((project) => (
        <ProjectSection
          key={project.id}
          project={project}
          selected={selectedOn(null)}
          onSelect={(worktreeId) =>
            select({ remote: null, projectId: project.id, worktreeId })
          }
        />
      ))
    );

  return (
    <nav
      aria-label="Projects and worktrees"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-[13px]"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold">Porcelain</span>
          <span
            className="truncate text-[11px] text-muted-foreground"
            title={`Connected to ${inventory.environment.name}`}
          >
            {inventory.environment.name}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Open project"
          title="Open project"
          onClick={openProject}
        >
          <PlusIcon />
        </Button>
      </header>

      <ScrollArea className="h-0 min-h-0 flex-1">
        <div className="p-2">
          {desktopShell ? (
            <>
              <MachineSection name="This computer" icon={MonitorIcon}>
                {local}
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
          ) : (
            local
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
      <RenameProjectDialog connection={connection} />
      <RemoveProjectDialog connection={connection} />
    </nav>
  );
}
