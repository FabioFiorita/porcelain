import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  HouseIcon,
  KeyboardIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import logo from '../../assets/logo.png';
import type { Inventory, Project } from '../../domain/inventory';
import { projectPath, worktreeLabel } from '../../domain/inventory';
import { copyText } from './copy';
import { SHORTCUTS } from './shortcuts';

type Worktree = Project['worktrees'][number];
type WorktreeSummary = { pendingFiles?: number; openThreads?: number };

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
          className="ml-auto text-muted-foreground"
          aria-label="Open project"
          title="Open project"
          onClick={openProject}
        >
          <PlusIcon />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
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

      <footer className="flex shrink-0 items-center gap-1 border-t p-2">
        <Button
          variant="ghost"
          className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-xs text-muted-foreground"
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
          className="text-muted-foreground"
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

function ProjectSection({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: string | null | undefined;
  onSelect: (id: string) => void;
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
          <ContextMenuItem onClick={() => copyText(path, 'project path')}>
            <CopyIcon />
            Copy path
          </ContextMenuItem>
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
  const summary = (worktree as Worktree & { reviewSummary?: WorktreeSummary })
    .reviewSummary;
  const pending = summary?.pendingFiles ?? 0;
  const openThreads = summary?.openThreads ?? 0;

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
          {openThreads > 0 && (
            <span
              className="flex items-center gap-0.5 text-[10.5px]"
              role="img"
              aria-label={`${openThreads} open review ${openThreads === 1 ? 'thread' : 'threads'}`}
            >
              <MessageSquareIcon className="size-3" aria-hidden="true" />
              {openThreads}
            </span>
          )}
          {pending > 0 && (
            <Badge
              className="h-4 min-w-4 justify-center px-1 text-[10px]"
              aria-label={`${pending} pending ${pending === 1 ? 'file' : 'files'}`}
            >
              {pending}
            </Badge>
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
