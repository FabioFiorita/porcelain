import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  FolderGit2Icon,
  FolderMinusIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  HouseIcon,
  KeyboardIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import logo from '../../../assets/logo.png';
import type { Inventory, Project } from '../inventory';
import { projectPath, worktreeLabel } from '../inventory';
import { copyText } from '@/shared/workspace/copy';
import { RemoveProjectDialog } from './remove-project-dialog';
import { RenameProjectDialog } from './rename-project-dialog';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

type Worktree = Project['worktrees'][number];

function worktreeDisplayLabel(worktree: Worktree) {
  return worktreeLabel(worktree.branch);
}

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
  const [removing, setRemoving] = useState<Project | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const openProjectButton = useRef<HTMLButtonElement>(null);

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
          ref={openProjectButton}
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
                onRename={setRenaming}
                onRemove={setRemoving}
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
      {renaming && (
        <RenameProjectDialog
          project={renaming}
          onClose={() => setRenaming(null)}
          finalFocus={openProjectButton}
        />
      )}
      {removing && (
        <RemoveProjectDialog
          project={removing}
          onClose={() => setRemoving(null)}
          finalFocus={openProjectButton}
        />
      )}
    </nav>
  );
}

function ProjectSection({
  project,
  selected,
  onSelect,
  onRename,
  onRemove,
}: {
  project: Project;
  selected: string | null | undefined;
  onSelect: (id: string) => void;
  onRename: (project: Project) => void;
  onRemove: (project: Project) => void;
}) {
  const path = projectPath(project);
  return (
    <Collapsible defaultOpen className="group/project mb-2">
      <ContextMenu>
        <ContextMenuTrigger render={<div className="rounded-md" />}>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                title={project.name}
                aria-label={project.name}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-accent"
              />
            }
          >
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-open/project:rotate-90" />
            <FolderGit2Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <h3 className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium">
              {project.name}
            </h3>
            {!project.available && (
              <CircleAlertIcon
                aria-label="Project unavailable"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </CollapsibleTrigger>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => copyText(path, 'project path')}>
              <CopyIcon />
              Copy path
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => onRename(project)}>
              <PencilIcon />
              Rename project
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={() => onRemove(project)}
            >
              <FolderMinusIcon />
              Remove from Porcelain
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        {path && (
          <p
            className="truncate pb-1 pl-8 font-mono text-[10.5px] text-muted-foreground"
            title={path}
          >
            {path}
          </p>
        )}
        {project.worktrees.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">
            No worktrees found.
          </p>
        ) : (
          project.worktrees.map((worktree) => (
            <WorktreeRow
              key={worktree.id}
              worktree={worktree}
              projectName={project.name}
              selected={selected === worktree.id}
              onSelect={onSelect}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

const STATUS_LABEL = {
  pending: 'Waiting for your review',
  reviewed: 'Reviewed, waiting for a commit',
  replied: 'The agent replied',
} as const;

const STATUS_STYLE = {
  pending: 'bg-yellow-500',
  reviewed: 'bg-graph-2',
  replied: 'bg-blue-500',
} as const;

function WorktreeRow({
  worktree,
  projectName,
  selected,
  onSelect,
}: {
  worktree: Worktree;
  projectName: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = worktree.main
    ? HouseIcon
    : worktree.branch === null
      ? GitCommitHorizontalIcon
      : GitBranchIcon;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-pressed={selected}
            aria-current={selected ? 'page' : undefined}
            data-unavailable={!worktree.available || undefined}
            onClick={() => onSelect(worktree.id)}
            className={cn(
              'flex w-full min-w-0 items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-7 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              selected && 'bg-accent font-medium text-foreground',
              !worktree.available && 'opacity-60',
            )}
          />
        }
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate">{worktreeDisplayLabel(worktree)}</span>
          <span className="sr-only">{worktree.path}</span>
          <span className="sr-only">{projectName}</span>
          {!worktree.available && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CircleAlertIcon className="size-3" aria-hidden="true" />
              Unavailable
            </span>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {worktree.status && (
            <span
              className={cn(
                'size-2 rounded-full',
                STATUS_STYLE[worktree.status],
              )}
              role="img"
              title={STATUS_LABEL[worktree.status]}
              aria-label={STATUS_LABEL[worktree.status]}
            />
          )}
          {worktree.main && <span className="sr-only">Main worktree</span>}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <ContextMenuItem
          onClick={() =>
            copyText(worktreeDisplayLabel(worktree), 'branch name')
          }
          disabled={worktree.branch == null}
        >
          <GitBranchIcon />
          Copy name
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => copyText(worktree.path, 'worktree path')}
        >
          <CopyIcon />
          Copy path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
