import { openProjectDialog } from '../overlays';
import {
  projectPath,
  projectUnavailableMessage,
} from '@porcelain/client/projects/rules';
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
} from 'lucide-react';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
  refreshInventories,
  worktreeNavigatorState,
} from '@porcelain/client/projects';
import {
  emptyNavigatorFilter,
  navigatorEntryLabel,
  navigatorEntrySelected,
  navigatorChecksLabel,
  navigatorRowTitle,
  navigatorRowTrailing,
  navigatorVisibleRows,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import {
  EnvironmentGlyph,
  remoteConnectionStatus,
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
  EmptyContent,
} from '@/components/ui/empty';
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

type Props = {
  remotes: readonly RemoteConnection[] | undefined;
  selected:
    | Pick<WorktreeTarget, 'remote' | 'projectId' | 'worktreeId'>
    | undefined;
  showRemoteNotice?: boolean | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenPullRequest: (entry: NavigatorEntry) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  remotes,
  selected,
  onSelect,
  onOpenPullRequest,
  onOpenProject,
  onOpenSettings,
  showRemoteNotice,
  onOpenShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const settingsButton = useElement<HTMLButtonElement>();
  const firstEntry = useElement<HTMLElement>();
  const lastEntry = useElement<HTMLElement>();
  const connections = [
    connection,
    ...(remotes ?? []).map((entry) => entry.connection),
  ];
  const { projects, filters, loading, neverRead } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const state = useAtomValue(worktreeNavigatorState);
  const setState = useAtomSet(worktreeNavigatorState);
  const { query, filter } = state;
  useAtomMount(refreshInventories(connections));
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  const location = useLocation();
  const [menu, setMenu] = useState({
    pathname: location.pathname,
    open: false,
  });
  const menuOpen = menu.pathname === location.pathname && menu.open;
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
  const searching = query.trim().length > 0;
  const shownProjects = projects.map((source) => ({
    source,
    shown: navigatorVisibleRows(source.entries, {
      selectedKey: source.entries.find(
        (entry) =>
          selection !== undefined && navigatorEntrySelected(entry, selection),
      )?.key,
      showAll: state.showingAll[source.key] === true,
      searching,
    }),
  }));
  const setShowingAll = (key: string, showingAll: boolean) =>
    setState((current) => ({
      ...current,
      showingAll: { ...current.showingAll, [key]: showingAll },
    }));
  const visibleEntries = shownProjects
    .flatMap(({ source, shown }) => (source.expanded ? shown.rows : []))
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
            onOpenChange={(open) =>
              setMenu({ pathname: location.pathname, open })
            }
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
          {shownProjects.map(({ source, shown }) => (
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
                    reconnecting={
                      showRemoteNotice &&
                      selected?.remote === source.connection.environmentId &&
                      selected.projectId === source.project.id
                    }
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
                {!source.project.available && (
                  <div className="flex flex-col gap-2 px-2 py-2">
                    <p role="status" className="text-xs text-muted-foreground">
                      {projectUnavailableMessage(source.project)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {['Reconnect', 'Choose folder'].map((label) => (
                        <Button
                          key={label}
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            openProjectDialog.openWithPayload({
                              remote:
                                source.connection.environmentId ===
                                connection.environmentId
                                  ? null
                                  : source.connection.environmentId,
                              project: source.project,
                              ...(label === 'Reconnect' &&
                              projectPath(source.project)
                                ? { path: projectPath(source.project) }
                                : {}),
                            })
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <CollapsibleContent>
                  <SidebarMenu>
                    {shown.rows.map((entry) => {
                      const active =
                        selection !== undefined &&
                        navigatorEntrySelected(entry, selection);
                      const review =
                        entry.pullRequest.state === 'available'
                          ? entry.pullRequest
                          : undefined;
                      const title = navigatorRowTitle(entry);
                      const trailing = navigatorRowTrailing(entry);
                      const disclosure = [
                        title,
                        entry.name !== title ? entry.name : undefined,
                        entry.path,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      const EntryIcon = entryIcon(entry);
                      const failed =
                        review?.checks?.state === 'available' &&
                        review.checks.result === 'failed';
                      let attach =
                        entry.key === lastKey ? lastEntry.attach : undefined;
                      if (entry.key === firstKey) attach = firstEntry.attach;
                      const label = `${navigatorEntryLabel(entry)}${active ? ', Current' : ''}`;
                      return (
                        <SidebarMenuItem key={entry.key}>
                          <NavigatorRowMenu
                            onRetryChanges={() =>
                              retry({ environmentId: entry.environmentId })
                            }
                            entry={entry}
                            context={{
                              connection:
                                connections.find(
                                  (candidate) =>
                                    candidate.environmentId ===
                                    source.connection.environmentId,
                                ) ?? connection,
                              remoteStatus:
                                source.connection.environmentId ===
                                connection.environmentId
                                  ? undefined
                                  : remoteConnectionStatus(
                                      source.connection.environmentId,
                                    ),
                            }}
                          >
                            <TruncatedText
                              text={disclosure}
                              disclose="always"
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
                                    <ItemMedia>
                                      <EntryIcon className="size-3.5 text-muted-foreground" />
                                    </ItemMedia>
                                    <ItemContent className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1">
                                        {clip(
                                          title,
                                          active
                                            ? 'min-w-0 flex-1 font-semibold'
                                            : 'min-w-0 flex-1 font-medium',
                                        )}
                                        {failed && (
                                          <CircleAlertIcon
                                            className="size-3 shrink-0 text-del-fg"
                                            aria-label="Checks failed"
                                          />
                                        )}
                                        {trailing?.kind === 'pull-request' && (
                                          <Button
                                            variant="ghost"
                                            size="xs"
                                            className="pointer-events-auto relative shrink-0 cursor-pointer"
                                            aria-label={`Open PR #${trailing.number} · ${entry.projectName} · ${entry.environmentName} · ${navigatorChecksLabel(review?.checks)}`}
                                            onClick={() => {
                                              onOpenPullRequest(entry);
                                              setOpenMobile(false);
                                            }}
                                          >
                                            <span className="text-2xs text-muted-foreground tabular-nums">
                                              {trailing.text}
                                            </span>
                                          </Button>
                                        )}
                                        {trailing?.kind === 'changes' && (
                                          <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                                            {trailing.text}
                                          </span>
                                        )}
                                      </div>
                                    </ItemContent>
                                  </Item>
                                </div>
                              )}
                            />
                          </NavigatorRowMenu>
                        </SidebarMenuItem>
                      );
                    })}
                    {(shown.more > 0 || shown.less) && (
                      <SidebarMenuItem>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="w-full cursor-pointer justify-start"
                          onClick={() =>
                            setShowingAll(source.key, shown.more > 0)
                          }
                        >
                          <span className="text-muted-foreground">
                            {shown.more > 0
                              ? `Show ${shown.more} more`
                              : 'Show less'}
                          </span>
                        </Button>
                      </SidebarMenuItem>
                    )}
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
          {!loading && projects.length === 0 && neverRead && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Couldn’t reach Porcelain</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => retry(undefined)}>
                  Try again
                </Button>
              </EmptyContent>
            </Empty>
          )}
          {!loading && projects.length === 0 && !neverRead && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </SidebarContent>
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
                  aria-label="Settings"
                  onClick={onOpenSettings}
                />
              }
            >
              <SettingsIcon className="text-muted-foreground" />
              <TruncatedText text="Settings" />
            </TooltipTrigger>
            <TooltipContent role="tooltip">
              Settings <Kbd>{formatForDisplay(SHORTCUTS.openSettings)}</Kbd>
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
