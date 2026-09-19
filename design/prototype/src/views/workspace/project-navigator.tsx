import { formatForDisplay } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import {
  ChevronRight,
  Copy,
  Ellipsis,
  FolderGit2,
  FolderMinus,
  FolderX,
  GitBranch,
  Keyboard,
  Pencil,
  Plus,
  Settings,
  TextCursorInput,
} from 'lucide-react';
import { type ComponentType, type ReactNode, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import logo from '../../assets/logo.png';
import {
  type Inventory,
  type Project,
  projectPath,
  type Worktree,
  worktreeDot,
  worktreeLabel,
} from '../../domain/inventory';
import { useRemoveProject } from '../../query/inventory';
import { reviewErrorMessage } from '../../query/review';
import { ConnectionPill } from './connection-pill';
import { copyText } from './copy';
import { RenameProjectDialog } from './rename-project-dialog';
import { SHORTCUTS } from './shortcuts';

type Props = {
  inventory: Inventory;
  selectedWorktreeId: string | undefined;
  /** After a worktree is picked (the floating navigator closes). */
  /** A worktree was picked (the phone slide-over closes). */
  onSelect?: (worktreeId: string) => void;
  onOpenProject: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

/**
 * Projects and their worktrees, as Git lists them. Navigation only: nothing here
 * edits Git, and nothing refreshes; the live channel adds and removes worktrees.
 * Each worktree carries at most one dot, never a count.
 */
export function ProjectNavigator({
  inventory,
  selectedWorktreeId,
  onSelect,
  onOpenProject,
  onOpenSettings,
  onOpenShortcuts,
}: Props) {
  const [removing, setRemoving] = useState<Project | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);

  return (
    <nav
      aria-label="Projects"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
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
          onClick={onOpenProject}
        >
          <Plus />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {inventory.projects.map((project) => {
          const actions: ProjectActions = {
            rename: () => setRenaming(project),
            remove: () => setRemoving(project),
          };
          return project.available ? (
            <AvailableProject
              key={project.id}
              project={project}
              actions={actions}
              selectedWorktreeId={selectedWorktreeId}
              onSelect={onSelect}
            />
          ) : (
            <UnavailableProject
              key={project.id}
              project={project}
              actions={actions}
            />
          );
        })}
      </div>

      <footer className="flex shrink-0 items-center gap-1 border-t p-2">
        <Button
          variant="ghost"
          className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-xs text-muted-foreground"
          aria-keyshortcuts={SHORTCUTS.openSettings}
          title={`Settings (${formatForDisplay(SHORTCUTS.openSettings)})`}
          onClick={onOpenSettings}
        >
          <Settings className="size-3.5" />
          Settings
        </Button>
        <ConnectionPill />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts={SHORTCUTS.openShortcuts}
          title={`Keyboard shortcuts (${formatForDisplay(SHORTCUTS.openShortcuts)})`}
          onClick={onOpenShortcuts}
        >
          <Keyboard />
        </Button>
      </footer>

      <RenameProjectDialog
        project={renaming}
        onClose={() => setRenaming(null)}
      />
      <RemoveProjectDialog
        project={removing}
        selectedWorktreeId={selectedWorktreeId}
        onClose={() => setRemoving(null)}
      />
    </nav>
  );
}

type ProjectActions = { rename: () => void; remove: () => void };

type MenuParts = {
  Item: ComponentType<{
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'destructive';
    children: ReactNode;
  }>;
  Separator: ComponentType;
};

const CONTEXT_PARTS: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
};
const DROPDOWN_PARTS: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};

/** The same three actions from the ⋯ button and from a right-click. Nothing on disk is touched. */
function ProjectMenuItems({
  project,
  actions,
  parts,
}: {
  project: Project;
  actions: ProjectActions;
  parts: MenuParts;
}) {
  const { Item, Separator } = parts;
  const path = projectPath(project);
  return (
    <>
      <Item onClick={actions.rename}>
        <Pencil />
        Rename…
      </Item>
      <Item
        disabled={path === ''}
        onClick={() => copyText(path, 'project path')}
      >
        <Copy />
        Copy path
      </Item>
      <Separator />
      <Item variant="destructive" onClick={actions.remove}>
        <FolderMinus />
        Remove from Porcelain
      </Item>
    </>
  );
}

/** The ⋯ button at the end of a project row: shown on hover or focus, while its menu is open, and always on touch. */
function ProjectMenuButton({
  project,
  actions,
}: {
  project: Project;
  actions: ProjectActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${project.name} actions`}
            className="shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <ProjectMenuItems
          project={project}
          actions={actions}
          parts={DROPDOWN_PARTS}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AvailableProject({
  project,
  actions,
  selectedWorktreeId,
  onSelect,
}: {
  project: Project;
  actions: ProjectActions;
  selectedWorktreeId: string | undefined;
  onSelect: ((worktreeId: string) => void) | undefined;
}) {
  const path = projectPath(project);
  return (
    <Collapsible defaultOpen className="group/project mb-2">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div className="group/row flex items-center gap-0.5 rounded-md pr-1 hover:bg-accent" />
          }
        >
          <CollapsibleTrigger
            render={
              <button
                type="button"
                title={path}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
              />
            }
          >
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[open]/project:rotate-90" />
            <FolderGit2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-[12.5px] font-medium">
              {project.name}
            </span>
          </CollapsibleTrigger>
          <ProjectMenuButton project={project} actions={actions} />
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ProjectMenuItems
            project={project}
            actions={actions}
            parts={CONTEXT_PARTS}
          />
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        <p className="truncate pb-1 pl-8 font-mono text-[10.5px] text-muted-foreground">
          {path}
        </p>
        {project.worktrees.map((worktree) => (
          <WorktreeRow
            key={worktree.id}
            worktree={worktree}
            selected={worktree.id === selectedWorktreeId}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The repository cannot be reached (a disconnected drive, a moved folder): its
 * worktrees cannot be listed, so there are none to open. It can still be renamed
 * or removed, and it comes back by itself once the server can read it again.
 */
function UnavailableProject({
  project,
  actions,
}: {
  project: Project;
  actions: ProjectActions;
}) {
  const path = projectPath(project);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div className="group/row mb-2 flex items-start gap-0.5 rounded-md py-1 pr-1 pl-1.5 hover:bg-accent/60" />
        }
      >
        <div
          className="flex min-w-0 flex-1 items-start gap-1.5 opacity-60"
          title={`The server can’t read ${path} (a disconnected drive or a moved folder), so its worktrees can’t be listed. It comes back by itself once it can.`}
        >
          {/* Keeps the name in line with the names of openable projects, which have a chevron here. */}
          <span className="size-3.5 shrink-0" />
          <FolderX className="mt-px size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium">{project.name}</p>
            <p className="truncate font-mono text-[10.5px] text-muted-foreground">
              {path}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Repository can’t be reached
            </p>
          </div>
        </div>
        <ProjectMenuButton project={project} actions={actions} />
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <ProjectMenuItems
          project={project}
          actions={actions}
          parts={CONTEXT_PARTS}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function WorktreeRow({
  worktree,
  selected,
  onSelect,
}: {
  worktree: Worktree;
  selected: boolean;
  onSelect: ((worktreeId: string) => void) | undefined;
}) {
  const navigate = useNavigate({ from: '/' });
  const label = worktreeLabel(worktree.branch);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => {
              void navigate({ search: { worktree: worktree.id } });
              onSelect?.(worktree.id);
            }}
            className={cn(
              'flex w-full min-w-0 items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-7 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              selected && 'bg-accent font-medium text-foreground',
            )}
          />
        }
      >
        <GitBranch className="size-3.5 shrink-0" />
        {/* The path lives on the name, so hovering the dot shows only the dot's tooltip. */}
        <span className="min-w-0 flex-1 truncate" title={worktree.path}>
          {label}
        </span>
        <WorktreeDotMark worktree={worktree} />
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <ContextMenuItem
          disabled={worktree.branch == null}
          onClick={() => copyText(label, 'branch name')}
        >
          <TextCursorInput />
          Copy name
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => copyText(worktree.path, 'worktree path')}
        >
          <Copy />
          Copy path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const DOT_CLASS = {
  'review-ready': 'bg-emerald-500 dark:bg-emerald-400',
  reviewed: 'border-[1.5px] border-emerald-500 dark:border-emerald-400',
  'agent-replied': 'bg-amber-400 dark:bg-amber-300',
} as const;

/** Green: a review is ready. Hollow green: every layer reviewed, ready to commit. Yellow: the agent replied. */
function WorktreeDotMark({ worktree }: { worktree: Worktree }) {
  const dot = worktreeDot(worktree);
  if (dot == null) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="grid size-4 shrink-0 place-items-center" />}
      >
        <span
          aria-hidden="true"
          className={cn('size-2 rounded-full', DOT_CLASS[dot.kind])}
        />
        <span className="sr-only">{dot.tooltip}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{dot.tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Removing forgets the project in Porcelain. The repository and its worktrees stay on disk. */
function RemoveProjectDialog({
  project,
  selectedWorktreeId,
  onClose,
}: {
  project: Project | null;
  selectedWorktreeId: string | undefined;
  onClose: () => void;
}) {
  const remove = useRemoveProject();
  const navigate = useNavigate({ from: '/' });
  const count = project?.worktrees.length ?? 0;

  return (
    <AlertDialog
      open={project != null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          remove.reset();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <FolderMinus />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Remove {project?.name} from Porcelain?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count > 0
              ? `Its ${count} worktree${count === 1 ? '' : 's'} leave the sidebar. `
              : 'It leaves the sidebar. '}
            Nothing is deleted from disk, and comment threads stay in the
            repository. You can open it again at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error != null && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {reviewErrorMessage(remove.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={project == null || remove.isPending}
            onClick={() => {
              if (project == null) return;
              const hadSelection = project.worktrees.some(
                (worktree) => worktree.id === selectedWorktreeId,
              );
              remove.submit(project.id).then(
                () => {
                  onClose();
                  toast.add({
                    title: `Removed ${project.name}`,
                    description: 'The repository is still on disk.',
                  });
                  // Leaving `worktree` out lets the workspace land on the next waiting worktree.
                  if (hadSelection) void navigate({ search: {} });
                },
                () => undefined,
              );
            }}
          >
            {remove.isPending ? <Spinner /> : <FolderMinus />}
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
