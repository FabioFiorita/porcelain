import { formatForDisplay } from '@tanstack/react-hotkeys';
import { PlusIcon, SettingsIcon, KeyboardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import logo from '../../../assets/logo.png';
import type { Inventory } from '../rules/inventory';
import { RemoveProjectDialog } from './remove-project-dialog';
import { RenameProjectDialog } from './rename-project-dialog';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { ProjectSection } from './project-section';

type Props = {
  inventory: Inventory;
  selectedWorktreeId: string | undefined;
  onSelect: (id: string) => void;
  onOpenProject: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  inventory,
  selectedWorktreeId: selected,
  onSelect: select,
  onOpenProject: openProject,
  onOpenSettings: openSettings,
  onOpenShortcuts: openShortcuts,
}: Props) {
  const projects = inventory.projects;

  return (
    <nav
      aria-label="Projects and worktrees"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-[13px]"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-6 shrink-0 rounded-md"
        />
        <span className="text-sm font-semibold">Porcelain</span>
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
          {projects.length === 0 ? (
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
                selected={selected}
                onSelect={select}
              />
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
      <RenameProjectDialog />
      <RemoveProjectDialog />
    </nav>
  );
}
