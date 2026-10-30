import { TruncatedText } from '@/shared/views/truncated-text';
import { NavigatorRowMenu } from './navigator-row-menu';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { useState } from 'react';
import { useElement } from '@/shared/hooks/use-element';
import { useAtomValue, useAtomSet, useAtomMount } from '@effect/atom-react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  FolderCogIcon,
  KeyboardIcon,
  ListFilterIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
  MonitorIcon,
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
  navigatorReviewLabel,
  navigatorChangesLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import { UpdatesMenu, useConnectedContext } from '@/features/access/index';
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Item, ItemContent } from '@/components/ui/item';
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
import { ProjectActions } from './project-actions';
import { NavigatorHeader } from './navigator-header';
import { OpenProjectMenu } from './open-project-menu';

type Props = {
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  openReview: { reviewId: string; environment: string | undefined } | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenPullRequest: (entry: NavigatorEntry) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  remotes,
  selected,
  openReview,
  onSelect,
  onOpenPullRequest,
  onOpenProject,
  onOpenSettings,
  onOpenShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const settingsButton = useElement<HTMLButtonElement>();
  const searchButton = useElement<HTMLButtonElement>();
  const firstEntry = useElement<HTMLButtonElement>();
  const lastEntry = useElement<HTMLButtonElement>();
  const connections = [
    connection,
    ...(remotes ?? []).map((entry) => entry.connection),
  ];
  const { projects, allProjects, filters, loading, messages } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const state = useAtomValue(worktreeNavigatorState);
  const setState = useAtomSet(worktreeNavigatorState);
  const { query, filter } = state;
  const [searching, setSearching] = useState(query.length > 0);
  useAtomMount(refreshInventories(connections));
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  const location = useLocation();
  const [menu, setMenu] = useState({ href: location.href, open: false });
  const menuOpen = menu.href === location.href && menu.open;
  const setQuery = (query: string) =>
    setState((current) => ({ ...current, query }));
  const filtered =
    filter.projects !== undefined ||
    filter.environments !== undefined ||
    filter.reviews !== undefined ||
    filter.older;
  const closeSearch = () => {
    setQuery('');
    setSearching(false);
    searchButton.element?.focus();
  };
  const { setOpenMobile } = useSidebar();
  const checkoutSelection = selected
    ? {
        kind: 'worktree' as const,
        worktreeId: selected.worktreeId,
        environmentId: selected.remote ?? connection.environmentId,
      }
    : undefined;
  const selection = openReview
    ? {
        kind: 'review' as const,
        reviewId: openReview.reviewId,
        environmentId: openReview.environment ?? connection.environmentId,
      }
    : checkoutSelection;
  const visibleEntries = projects
    .flatMap((project) => (project.expanded ? project.entries : []))
    .filter(
      (entry) =>
        entry.available ||
        entry.kind === 'review' ||
        entry.review.state === 'available',
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
    <div className="review-navigator h-full min-h-0 overflow-hidden bg-frame text-ui [--sidebar:var(--frame)] [--sidebar-foreground:var(--foreground)]">
      <Sidebar
        role="navigation"
        collapsible="none"
        className="h-full w-full min-h-0 overflow-hidden"
        aria-label="Projects and worktrees"
      >
        <NavigatorHeader>
          <div className="ml-auto flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    ref={(element) => searchButton.attach(element)}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      searching
                        ? 'Close search'
                        : 'Search reviews and worktrees'
                    }
                    aria-expanded={searching}
                    onClick={() =>
                      searching ? closeSearch() : setSearching(true)
                    }
                  />
                }
              >
                {searching ? <XIcon /> : <SearchIcon />}
              </TooltipTrigger>
              <TooltipContent>
                {searching ? 'Close search' : 'Search reviews and worktrees'}
              </TooltipContent>
            </Tooltip>
            <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
          </div>
        </NavigatorHeader>
        <div className="navigator-filters mb-2 flex items-center gap-1 px-2">
          {searching && (
            <InputGroup className="min-w-0 flex-1">
              <InputGroupInput
                autoFocus
                type="search"
                aria-label="Search reviews and worktrees"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closeSearch();
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
          )}
          <DropdownMenu
            highlightItemOnHover={false}
            open={menuOpen}
            onOpenChange={(open) => setMenu({ href: location.href, open })}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant={filtered ? 'secondary' : 'ghost'}
                        size="icon-sm"
                        aria-label="Filter worktrees"
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
              className="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
            >
              {filters.map((section) => (
                <DropdownMenuGroup key={section.key}>
                  <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                  {section.items.map((option) => (
                    <TruncatedText
                      propagateEscape
                      key={option.id}
                      text={option.label}
                      className="min-w-0 flex-1"
                      renderTrigger={(label) => (
                        <DropdownMenuCheckboxItem
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
                          {label}
                        </DropdownMenuCheckboxItem>
                      )}
                    />
                  ))}
                  <DropdownMenuSeparator />
                </DropdownMenuGroup>
              ))}
              <DropdownMenuCheckboxItem
                checked={filter.older}
                closeOnClick={false}
                onCheckedChange={(older) =>
                  setState((current) => ({
                    ...current,
                    filter: { ...current.filter, older },
                  }))
                }
              >
                Show older reviews
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    filter: emptyNavigatorFilter,
                  }))
                }
              >
                Clear filters
              </DropdownMenuItem>
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
            <SidebarGroup key={source.key}>
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
                  <SidebarGroupLabel
                    render={<CollapsibleTrigger />}
                    aria-label={`${source.project.name} · ${source.environmentName}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <ChevronDownIcon className="group-data-closed/project:-rotate-90" />
                    <TruncatedText text={source.project.name} />
                  </SidebarGroupLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Computer: ${source.environmentName}`}
                        />
                      }
                    >
                      <Badge variant="secondary">
                        <MonitorIcon />
                        <TruncatedText
                          text={source.environmentName}
                          className="max-w-20"
                        />
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent>
                      <p className="break-words">{source.environmentName}</p>
                      <p className="break-all text-muted-foreground">
                        Environment {source.connection.environmentId}
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <CollapsibleContent>
                  <SidebarMenu>
                    {source.entries.map((entry) => {
                      const active =
                        selection !== undefined &&
                        navigatorEntrySelected(entry, selection);
                      const review =
                        entry.review.state === 'available'
                          ? entry.review
                          : undefined;
                      const retained = entry.kind === 'review';
                      const openRetained =
                        retained || (!entry.available && review !== undefined);
                      let attach =
                        entry.key === lastKey ? lastEntry.attach : undefined;
                      if (entry.key === firstKey) attach = firstEntry.attach;
                      let identity = retained ? 'Older review' : 'Worktree';
                      if (entry.detached) identity = 'Detached HEAD';
                      if (entry.main) identity = 'Main worktree';
                      const label = `${navigatorEntryLabel(entry)}${active ? ', Current' : ''}`;
                      return (
                        <SidebarMenuItem key={entry.key}>
                          <NavigatorRowMenu
                            entry={entry}
                            connection={
                              connections.find(
                                (candidate) =>
                                  candidate.environmentId ===
                                  source.connection.environmentId,
                              ) ?? connection
                            }
                            onRetry={() => retry(undefined)}
                            beforeLeave={() => setOpenMobile(false)}
                          >
                            <Item
                              data-navigator-card=""
                              variant={active ? 'muted' : 'outline'}
                              size="xs"
                            >
                              <ItemContent className="min-w-0">
                                <div className="flex min-w-0 items-start gap-1">
                                  <SidebarMenuButton
                                    size="lg"
                                    aria-label={label}
                                    aria-current={active ? 'page' : undefined}
                                    disabled={!openRetained && !entry.available}
                                    ref={attach}
                                    onClick={() =>
                                      openRetained
                                        ? setOpenMobile(false)
                                        : openWorktree(entry)
                                    }
                                    render={
                                      openRetained && review ? (
                                        <Link
                                          to="/reviews/$reviewId"
                                          params={{ reviewId: review.reviewId }}
                                          search={{
                                            environment:
                                              entry.environmentId ===
                                              connection.environmentId
                                                ? undefined
                                                : entry.environmentId,
                                            decision: undefined,
                                          }}
                                        />
                                      ) : undefined
                                    }
                                  >
                                    <div className="min-w-0 flex-1">
                                      <TruncatedText
                                        text={
                                          entry.path
                                            ? `${entry.name} · ${entry.path}`
                                            : entry.name
                                        }
                                        disclose={
                                          entry.detached ? 'always' : 'clipped'
                                        }
                                        className="block font-medium"
                                      >
                                        {entry.name}
                                      </TruncatedText>
                                      <span className="block text-xs text-muted-foreground">
                                        {identity}
                                        {active ? ' · Current' : ''}
                                        {!entry.available && !retained
                                          ? ' · Unavailable'
                                          : ''}
                                      </span>
                                    </div>
                                  </SidebarMenuButton>
                                  {review?.pullRequestNumber && (
                                    <Button
                                      variant="secondary"
                                      size="xs"
                                      aria-label={`Open PR #${review.pullRequestNumber} · ${entry.projectName} · ${entry.environmentName}`}
                                      onClick={() => {
                                        onOpenPullRequest(entry);
                                        setOpenMobile(false);
                                      }}
                                    >
                                      PR #{review.pullRequestNumber}
                                    </Button>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 px-2 text-xs text-muted-foreground">
                                  {!retained &&
                                    (entry.changes.state === 'loading' ? (
                                      <Skeleton
                                        className="h-3 w-28"
                                        role="status"
                                        aria-label="Reading changes…"
                                      />
                                    ) : (
                                      <span>
                                        {navigatorChangesLabel(entry.changes)}
                                      </span>
                                    ))}
                                  {entry.review.state === 'loading' ||
                                  (review &&
                                    !review.closed &&
                                    !review.archived &&
                                    !review.progress &&
                                    !review.progressUnavailable &&
                                    !review.retained) ? (
                                    <Skeleton
                                      className="h-3 w-32"
                                      role="status"
                                      aria-label="Reading review…"
                                    />
                                  ) : (
                                    <span>
                                      {navigatorReviewLabel(entry.review)}
                                    </span>
                                  )}
                                </div>
                              </ItemContent>
                            </Item>
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
                <EmptyTitle>
                  {query.trim() || filtered
                    ? 'No matching worktrees'
                    : 'No projects registered'}
                </EmptyTitle>
                <EmptyDescription>
                  {query.trim() || filtered
                    ? 'Try another search or clear the filters.'
                    : 'Open a Git repository to get started.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {messages.map((message) => (
            <p key={message} role="status" className="px-3 text-xs">
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
        <footer
          role="group"
          aria-label="Navigator controls"
          className="navigator-footer flex shrink-0 items-center gap-1 p-2"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  ref={(element) => settingsButton.attach(element)}
                  variant="ghost"
                  className="min-w-0 shrink"
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
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label="Manage projects"
                        />
                      }
                    />
                  }
                >
                  <FolderCogIcon className="text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Manage projects</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
              >
                {allProjects.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No projects registered</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  allProjects.map((source) => (
                    <div
                      role="group"
                      aria-label={
                        source.connection.environmentId ===
                        connection.environmentId
                          ? 'This computer'
                          : source.environmentName
                      }
                      key={`${source.connection.environmentId}/${source.project.id}`}
                    >
                      <ProjectActions
                        key={`${source.connection.environmentId}/${source.project.id}`}
                        environmentId={
                          source.connection.environmentId ===
                          connection.environmentId
                            ? null
                            : source.connection.environmentId
                        }
                        project={source.project}
                        onRetry={() => retry(undefined)}
                      />
                    </div>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
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
    </div>
  );
}
