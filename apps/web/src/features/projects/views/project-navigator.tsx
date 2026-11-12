import {
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastTitle,
  ToastPortal,
  ToastProvider,
  ToastViewport,
  useToastManager,
} from '@/components/ui/toast';
import {
  worktreeStatusNotices,
  worktreeStatusToast,
  type WorktreeStatusIssue,
} from '../commands/worktree-status-notice';
import { TruncatedText } from '@/shared/views/truncated-text';
import { NavigatorRowMenu } from './navigator-row-menu';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { useState } from 'react';

import { useElement } from '@/shared/hooks/use-element';
import { useAtomValue, useAtomSet, useAtomMount } from '@effect/atom-react';
import { useLocation } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  CircleAlertIcon,
  GitBranchIcon,
  HouseIcon,
  KeyboardIcon,
  ListFilterIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
  refreshInventories,
  worktreeNavigatorState,
} from '@porcelain/client/projects';
import {
  emptyNavigatorFilter,
  navigatorEntrySelected,
  navigatorCardChangesLabel,
  navigatorChangesLabel,
  navigatorChecksLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import {
  EnvironmentGlyph,
  UpdatesMenu,
  useConnectedContext,
} from '@/features/access/index';
import type { RemoteConnection } from '@porcelain/client/access';
import type { WorktreeTarget } from '../rules/worktree-target';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from '@/components/ui/input-group';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Item, ItemContent, ItemMedia } from '@/components/ui/item';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SwitchWorktreeBranchDialog } from './switch-worktree-branch';
import { DeleteWorktreeDialog } from './delete-worktree';
import { ProjectActions } from './project-actions';
import { ProjectHeading } from './project-heading';
import { NavigatorHeader } from './navigator-header';
import { OpenProjectMenu } from './open-project-menu';

function entryIcon(entry: NavigatorEntry) {
  return entry.main ? HouseIcon : GitBranchIcon;
}

function StatusToasts({ container }: { container: HTMLElement | null }) {
  const { toasts } = useToastManager();
  if (!container) return null;
  return (
    <ToastPortal container={container}>
      <ToastViewport>
        {toasts.map((notice) => (
          <Toast key={notice.id} toast={notice}>
            <ToastContent>
              <div className="flex min-w-0 flex-1 flex-col gap-1 wrap-anywhere">
                <ToastTitle />
                <ToastDescription />
              </div>
              <ToastAction />
              <ToastClose />
            </ToastContent>
          </Toast>
        ))}
      </ToastViewport>
    </ToastPortal>
  );
}

function statusDescription(issue: WorktreeStatusIssue) {
  return (
    <Collapsible render={<span className="block" />}>
      <span className="block">
        {issue.failures.length}{' '}
        {issue.failures.length === 1 ? 'worktree' : 'worktrees'} ·{' '}
        <CollapsibleTrigger render={<Button variant="link" size="sm" />}>
          Details
        </CollapsibleTrigger>
      </span>
      <CollapsibleContent render={<span className="block" />}>
        <span
          role="list"
          tabIndex={0}
          aria-label="Affected worktrees"
          className="mt-2 block max-h-48 space-y-2 overflow-y-auto"
        >
          {issue.failures.map(({ entry, detail }) => (
            <span
              role="listitem"
              key={entry.key}
              className="block wrap-anywhere"
            >
              <span className="block font-medium">{entry.name}</span>
              {detail && <span className="block">{detail}</span>}
            </span>
          ))}
        </span>
      </CollapsibleContent>
    </Collapsible>
  );
}

type Props = {
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenPullRequest: (entry: NavigatorEntry) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  remotes,
  selected,
  onSelect,
  onOpenPullRequest,
  onOpenProject,
  onOpenSettings,
  settingsOpen,
  onOpenShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const [toastContainer, setToastContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const settingsButton = useElement<HTMLButtonElement>();
  const firstEntry = useElement<HTMLElement>();
  const lastEntry = useElement<HTMLElement>();
  const connections = [
    connection,
    ...(remotes ?? []).map((entry) => entry.connection),
  ];
  const { projects, filters, loading, messages } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const state = useAtomValue(worktreeNavigatorState);
  const setState = useAtomSet(worktreeNavigatorState);
  const { query, filter } = state;
  useAtomMount(refreshInventories(connections));
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  useAtomMount(
    worktreeStatusNotices({ connections, description: statusDescription }),
  );
  const location = useLocation();
  const [menu, setMenu] = useState({ href: location.href, open: false });
  const menuOpen = menu.href === location.href && menu.open;
  const setQuery = (query: string) =>
    setState((current) => ({ ...current, query }));
  const filtered =
    filter.projects !== undefined || filter.environments !== undefined;
  const emptyTitle =
    query.trim() || filtered
      ? 'No matching worktrees'
      : 'No projects registered';
  const emptyDescription =
    query.trim() || filtered
      ? 'Try another search or clear the filters.'
      : 'Open a Git repository to get started.';
  const { setOpenMobile, isMobile } = useSidebar();
  const checkoutSelection = selected
    ? {
        kind: 'worktree' as const,
        worktreeId: selected.worktreeId,
        environmentId: selected.remote ?? connection.environmentId,
      }
    : undefined;
  const selection = checkoutSelection;
  const visibleEntries = projects
    .flatMap((project) => (project.expanded ? project.entries : []))
    .filter(
      (entry) => entry.available || entry.pullRequest.state === 'available',
    );
  const firstKey = visibleEntries[0]?.key;
  const lastKey = visibleEntries.at(-1)?.key;
  const openWorktree = (entry: NavigatorEntry) => {
    if (!entry.worktreeId) return;
    onSelect({
      remote:
        entry.environmentId === connection.environmentId
          ? null
          : entry.environmentId,
      projectId: entry.projectId,
      worktreeId: entry.worktreeId,
    });
    setOpenMobile(false);
  };
  return (
    <div className="review-navigator h-full min-h-0 overflow-hidden bg-frame text-ui [--sidebar:var(--frame)] [--sidebar-foreground:var(--foreground)] [--muted:var(--card)] [--secondary:var(--card)] [--sidebar-accent:var(--card)]">
      <Sidebar
        role="navigation"
        collapsible="none"
        className="h-full w-full min-h-0 overflow-hidden"
        aria-label="Projects and worktrees"
      >
        <NavigatorHeader>
          <div className="ml-auto flex shrink-0 items-center">
            <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
          </div>
        </NavigatorHeader>
        <div className="navigator-filters mb-2 flex items-center gap-1 px-2">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupInput
              autoFocus={isMobile}
              type="search"
              aria-label="Search worktrees"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query.length > 0) {
                  event.stopPropagation();
                  setQuery('');
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  (event.key === 'ArrowDown'
                    ? firstEntry
                    : lastEntry
                  ).element?.focus();
                }
              }}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu
            open={menuOpen}
            onOpenChange={(open) => setMenu({ href: location.href, open })}
          >
            <Tooltip disableHoverablePopup>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <SidebarGroupAction
                        aria-label="Filter worktrees"
                        className="relative top-0 right-0 w-6 cursor-pointer"
                      />
                    }
                  />
                }
              >
                <ListFilterIcon />
              </TooltipTrigger>
              <TooltipContent>Filter worktrees</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              className="flex max-h-[min(24rem,var(--available-height))] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-hidden"
            >
              <div className="-m-1 min-h-0 overflow-y-auto p-1">
                {filters.map((section) => (
                  <DropdownMenuGroup key={section.key}>
                    <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                    {section.items.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        className="cursor-pointer"
                        checked={option.checked}
                        closeOnClick={false}
                        onCheckedChange={() =>
                          setState((current) => ({
                            ...current,
                            filter: {
                              ...current.filter,
                              [section.key]: option.next,
                            },
                          }))
                        }
                      >
                        {option.icon && <EnvironmentGlyph icon={option.icon} />}
                        <TruncatedText
                          propagateEscape
                          text={option.label}
                          className="min-w-0 flex-1"
                        />
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                  </DropdownMenuGroup>
                ))}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      filter: emptyNavigatorFilter,
                    }))
                  }
                >
                  Clear filters
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SidebarContent>
          {loading && (
            <div
              role="status"
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
            >
              <Spinner aria-label="Reading worktrees" />
              Reading worktrees…
            </div>
          )}
          {projects.map((source) => (
            <SidebarGroup key={source.key} className="mb-3">
              <Collapsible
                open={source.expanded}
                onOpenChange={(open) =>
                  setState((current) => ({
                    ...current,
                    expanded: { ...current.expanded, [source.key]: open },
                  }))
                }
                className="group/project"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <ProjectHeading
                    projectName={source.project.name}
                    environmentName={source.environmentName}
                    environmentIcon={source.environmentIcon}
                    showEnvironment={connections.length > 1}
                  />
                  <ProjectActions
                    project={source.project}
                    environmentId={
                      source.connection.environmentId ===
                      connection.environmentId
                        ? null
                        : source.connection.environmentId
                    }
                    environmentName={source.environmentName}
                  />
                  <Tooltip disableHoverablePopup>
                    <TooltipTrigger
                      render={
                        <CollapsibleTrigger
                          render={
                            <SidebarGroupAction
                              className="relative top-0 right-0 w-6 cursor-pointer"
                              aria-label={`${source.expanded ? 'Collapse' : 'Expand'} ${source.project.name} · ${source.environmentName}`}
                            />
                          }
                        />
                      }
                    >
                      <ChevronDownIcon className="group-data-closed/project:-rotate-90" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {source.expanded ? 'Collapse project' : 'Expand project'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CollapsibleContent>
                  <SidebarMenu>
                    {source.entries.map((entry) => {
                      const active =
                        selection !== undefined &&
                        navigatorEntrySelected(entry, selection);
                      const review =
                        entry.pullRequest.state === 'available'
                          ? entry.pullRequest
                          : undefined;
                      const changes =
                        entry.kind === 'worktree'
                          ? navigatorCardChangesLabel(entry.changes)
                          : '';
                      const EntryIcon = entryIcon(entry);
                      const failed =
                        review?.checks?.state === 'available' &&
                        review.checks.result === 'failed';
                      let attach =
                        entry.key === lastKey ? lastEntry.attach : undefined;
                      if (entry.key === firstKey) attach = firstEntry.attach;
                      const label = `${[entry.name, entry.projectName, entry.environmentName, entry.main ? 'Main worktree' : undefined, entry.detached ? 'Detached HEAD' : undefined, entry.detached ? entry.path : undefined, entry.kind === 'worktree' ? navigatorChangesLabel(entry.changes) : undefined, review?.number ? `Pull request #${review.number}` : undefined, !entry.available ? 'Unavailable' : undefined].filter(Boolean).join(', ')}${active ? ', Current' : ''}`;
                      return (
                        <SidebarMenuItem key={entry.key}>
                          <NavigatorRowMenu
                            onRetryChanges={() =>
                              retry({ environmentId: entry.environmentId })
                            }
                            entry={entry}
                            connection={
                              connections.find(
                                (candidate) =>
                                  candidate.environmentId ===
                                  source.connection.environmentId,
                              ) ?? connection
                            }
                          >
                            <TruncatedText
                              text={
                                entry.path
                                  ? `${entry.name} · ${entry.path}`
                                  : entry.name
                              }
                              disclose={entry.detached ? 'always' : 'clipped'}
                              renderTrigger={(_label, clip) => (
                                <div
                                  data-navigator-card=""
                                  role="presentation"
                                  tabIndex={-1}
                                  className={
                                    active
                                      ? 'relative rounded-md bg-card'
                                      : 'relative rounded-md hover:bg-card'
                                  }
                                >
                                  <Item
                                    className="absolute inset-0 h-full cursor-pointer"
                                    data-sidebar="menu-button"
                                    size="xs"
                                    aria-label={label}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => openWorktree(entry)}
                                    render={
                                      <button
                                        type="button"
                                        ref={attach}
                                        disabled={!entry.available}
                                      />
                                    }
                                  />
                                  <Item
                                    size="xs"
                                    className="pointer-events-none relative"
                                  >
                                    <ItemMedia className="self-start">
                                      <EntryIcon className="mt-0.5 size-3.5 text-muted-foreground" />
                                    </ItemMedia>
                                    <ItemContent className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1">
                                        {clip(
                                          entry.displayTitle ?? entry.name,
                                          active
                                            ? 'min-w-0 flex-1 font-semibold'
                                            : 'min-w-0 flex-1 font-medium',
                                        )}
                                        {entry.detached && (
                                          <span className="text-xs text-muted-foreground">
                                            Detached
                                          </span>
                                        )}
                                        {failed && (
                                          <CircleAlertIcon
                                            className="size-3 shrink-0 text-del-fg"
                                            aria-label="Checks failed"
                                          />
                                        )}
                                      </div>
                                      {entry.displayTitle && (
                                        <div className="min-w-0 font-mono text-2xs text-muted-foreground">
                                          {clip(
                                            entry.branch,
                                            'block font-mono text-2xs',
                                          )}
                                        </div>
                                      )}
                                      {(review?.number || changes) && (
                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
                                          {review?.number && (
                                            <Button
                                              variant="ghost"
                                              size="xs"
                                              className="relative pointer-events-auto cursor-pointer"
                                              aria-label={`Open PR #${review.number} · ${entry.projectName} · ${entry.environmentName} · ${navigatorChecksLabel(review.checks)}`}
                                              onClick={() => {
                                                onOpenPullRequest(entry);
                                                setOpenMobile(false);
                                              }}
                                            >
                                              <span className="text-muted-foreground">
                                                #{review.number}
                                              </span>
                                            </Button>
                                          )}
                                          {changes && (
                                            <span
                                              role="img"
                                              aria-label={`Local uncommitted changes: ${navigatorChangesLabel(entry.changes)}`}
                                            >
                                              {changes}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </ItemContent>
                                  </Item>
                                </div>
                              )}
                            />
                          </NavigatorRowMenu>
                        </SidebarMenuItem>
                      );
                    })}
                    {source.entries.length === 0 && !loading && (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        No matching worktrees
                      </p>
                    )}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          ))}
          {!loading && messages.length === 0 && projects.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {messages.map((message) => (
            <p
              key={message}
              role="status"
              className="px-3 text-xs wrap-anywhere"
            >
              {message}
            </p>
          ))}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => retry(undefined)}
            >
              Read again
            </Button>
          )}
        </SidebarContent>
        <div ref={setToastContainer}>
          <ToastProvider toastManager={worktreeStatusToast}>
            <StatusToasts container={toastContainer} />
          </ToastProvider>
        </div>
        <footer
          role="group"
          aria-label="Navigator controls"
          className="navigator-footer flex shrink-0 items-center gap-1 p-2"
        >
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  ref={(element) => settingsButton.attach(element)}
                  variant="ghost"
                  className="min-w-0 shrink"
                  aria-label={settingsOpen ? 'Close Settings' : 'Settings'}
                  type={settingsOpen ? 'submit' : 'button'}
                  form={settingsOpen ? 'close-settings' : undefined}
                  onClick={settingsOpen ? undefined : onOpenSettings}
                  onKeyDown={(event) => {
                    if (settingsOpen && event.key === 'Escape') {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              }
            >
              {settingsOpen ? (
                <XIcon />
              ) : (
                <SettingsIcon className="text-muted-foreground" />
              )}
              <TruncatedText text={settingsOpen ? 'Close' : 'Settings'} />
              {settingsOpen && (
                <Kbd>{formatForDisplay(SHORTCUTS.closeSettings)}</Kbd>
              )}
            </TooltipTrigger>
            <TooltipContent role="tooltip">
              {settingsOpen ? 'Close Settings' : 'Settings'}{' '}
              <Kbd>
                {formatForDisplay(
                  settingsOpen
                    ? SHORTCUTS.closeSettings
                    : SHORTCUTS.openSettings,
                )}
              </Kbd>
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <UpdatesMenu fallbackFocus={settingsButton} />
            <Tooltip disableHoverablePopup>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Keyboard shortcuts"
                    onClick={onOpenShortcuts}
                  />
                }
              >
                <KeyboardIcon className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent role="tooltip">
                Keyboard shortcuts{' '}
                <Kbd>{formatForDisplay(SHORTCUTS.openShortcuts)}</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </footer>
      </Sidebar>
      <DeleteWorktreeDialog />
      <SwitchWorktreeBranchDialog />
    </div>
  );
}
