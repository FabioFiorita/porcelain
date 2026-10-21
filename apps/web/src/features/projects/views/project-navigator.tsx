import { ArchiveReview } from './archive-review';
import { useState } from 'react';
import { useAtomValue, useAtomSet } from '@effect/atom-react';
import { Link } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CircleIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ChevronDownIcon,
  FilterIcon,
  KeyboardIcon,
  SearchIcon,
  SettingsIcon,
} from 'lucide-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import {
  emptyReviewListFilter,
  reviewListGroups,
  reviewListMeta,
  reviewListSignal,
  reviewListView,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { useConnectedContext } from '@/features/access/index';
import type { RemoteConnection } from '@porcelain/client/access';
import type { Inventory } from '@porcelain/client/projects/rules';
import type { WorktreeTarget } from '../rules/worktree-target';
import { usePreferences } from '@/features/preferences/index';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { ProjectActions } from './project-actions';
import { NavigatorHeader } from './navigator-header';
import { OpenProjectMenu } from './open-project-menu';

type Props = {
  inventory: Inventory;
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenRemotes: (environmentId: string) => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  inventory,
  remotes,
  selected,
  onSelect,
  onOpenProject,
  onOpenSettings,
  onOpenRemotes,
  onOpenShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const { preferences, setPreference } = usePreferences();
  const connections = [
    connection,
    ...(remotes ?? []).map((entry) => entry.connection),
  ];
  const { entries, loading, messages, projects } = useAtomValue(
    readReviewList(connections),
  );
  const retry = useAtomSet(refreshReviewList(connections));
  const [view, setView] = useState({
    query: '',
    filter: emptyReviewListFilter,
    closed: false,
  });
  const { query, filter, closed } = view;
  const [menuQuery, setMenuQuery] = useState('');
  const checkouts = [
    ...new Map(
      reviewListView(entries, menuQuery, emptyReviewListFilter, false)
        .rows.filter((entry) => entry.worktreeId)
        .map((entry) => [`${entry.environmentId}/${entry.worktreeId}`, entry]),
    ).values(),
  ];
  const currentCheckout = checkouts.find(
    (entry) =>
      selected?.worktreeId === entry.worktreeId &&
      (selected?.remote ?? connection.environmentId) === entry.environmentId,
  );
  const setQuery = (query: string) =>
    setView((current) => ({ ...current, query }));
  const setFilter = (filter: typeof emptyReviewListFilter) =>
    setView((current) => ({ ...current, filter }));
  const setClosed = (closed: boolean) =>
    setView((current) => ({ ...current, closed }));
  const emptyReviewsLabel = closed
    ? 'No closed reviews'
    : 'No matching worktrees';
  const emptyLabel =
    projects.length === 0 ? 'No projects registered' : emptyReviewsLabel;
  const { rows, filters } = reviewListView(entries, query, filter, closed);
  const { setOpenMobile } = useSidebar();
  const openWorktree = (entry: ReviewListEntry) => {
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
    <div className="h-full min-h-0 overflow-hidden rounded-xl border bg-card text-ui [--sidebar:var(--card)] [--sidebar-foreground:var(--foreground)]">
      <Sidebar
        role="navigation"
        collapsible="none"
        className="h-full w-full min-h-0 overflow-hidden"
        aria-label="Projects and worktrees"
      >
        <NavigatorHeader environment={inventory.environment.name}>
          <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
        </NavigatorHeader>
        <div className="flex gap-1 p-2">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupInput
              type="search"
              aria-label="Search reviews and worktrees"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu highlightItemOnHover={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant={
                    filter.projects !== undefined ||
                    filter.environments !== undefined
                      ? 'secondary'
                      : 'outline'
                  }
                  size="icon"
                  aria-label="Filter reviews"
                />
              }
            >
              <FilterIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
            >
              {filters.map((section) => (
                <DropdownMenuGroup key={section.key}>
                  <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                  {section.items.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.id}
                      checked={option.checked}
                      closeOnClick={false}
                      onCheckedChange={() =>
                        setFilter({ ...filter, [section.key]: option.next })
                      }
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={option.label}
                      >
                        {option.label}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                </DropdownMenuGroup>
              ))}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Projects</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
                  {projects.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No projects registered</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    projects.map((source) => (
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
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub
                highlightItemOnHover={false}
                onOpenChange={(open) => {
                  if (!open) setMenuQuery('');
                }}
              >
                <DropdownMenuSubTrigger>Worktrees</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Open a worktree</DropdownMenuLabel>
                    <InputGroup>
                      <InputGroupInput
                        type="search"
                        aria-label="Search worktrees"
                        placeholder="Search"
                        value={menuQuery}
                        onChange={(event) => setMenuQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            !['Escape', 'ArrowDown', 'ArrowUp', 'Tab'].includes(
                              event.key,
                            )
                          )
                            event.stopPropagation();
                        }}
                      />
                      <InputGroupAddon>
                        <SearchIcon />
                      </InputGroupAddon>
                    </InputGroup>
                    <DropdownMenuRadioGroup value={currentCheckout?.key ?? ''}>
                      {checkouts.map((entry) => (
                        <DropdownMenuRadioItem
                          key={entry.key}
                          value={entry.key}
                          disabled={entry.disabled}
                          onClick={() => openWorktree(entry)}
                        >
                          <span
                            className="min-w-0 flex-1 truncate"
                            title={`${entry.branch} · ${entry.projectName}`}
                          >
                            {entry.branch} · {entry.projectName}
                          </span>
                          <Badge
                            variant="secondary"
                            className="max-w-1/2"
                            title={entry.environmentName}
                          >
                            <span className="truncate">
                              {entry.environmentName}
                            </span>
                          </Badge>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    {!loading && checkouts.length === 0 ? (
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>No matching worktrees</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    ) : null}
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                onClick={() => setFilter(emptyReviewListFilter)}
              >
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={closed ? 'Back to reviews' : 'Closed reviews'}
                  aria-pressed={closed}
                  onClick={() => setClosed(!closed)}
                />
              }
            >
              {closed ? <ArrowLeftIcon /> : <ArchiveIcon />}
            </TooltipTrigger>
            <TooltipContent>
              {closed ? 'Back to reviews' : 'Closed reviews'}
            </TooltipContent>
          </Tooltip>
        </div>
        <SidebarContent>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Spinner aria-label="Reading worktrees" />
              Reading worktrees…
            </div>
          )}
          {(closed ? (['Closed'] as const) : reviewListGroups).map((group) => {
            const grouped =
              group === 'Closed'
                ? rows
                : rows.filter((row) => row.group === group);
            if (grouped.length === 0) return null;
            return (
              <SidebarGroup key={group}>
                <Collapsible
                  open={preferences.reviewListGroupOpen[group] ?? true}
                  onOpenChange={(open) =>
                    setPreference('reviewListGroupOpen', {
                      ...preferences.reviewListGroupOpen,
                      [group]: open,
                    })
                  }
                  className="group/review-list"
                >
                  <SidebarGroupLabel
                    render={<CollapsibleTrigger />}
                    className="w-full cursor-pointer"
                  >
                    {group} · {grouped.length}
                    <ChevronDownIcon className="ml-auto group-data-closed/review-list:-rotate-90" />
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {grouped.map((entry) => {
                        const signal = reviewListSignal(entry);
                        const indicator = {
                          destructive: {
                            Icon: CircleAlertIcon,
                            className: 'text-destructive',
                          },
                          primary: {
                            Icon: CircleCheckIcon,
                            className: 'text-primary',
                          },
                          muted: {
                            Icon: CircleIcon,
                            className: 'text-muted-foreground',
                          },
                        }[signal?.tone ?? 'muted'];
                        return (
                          <SidebarMenuItem
                            key={entry.key}
                            className="flex items-start"
                          >
                            <SidebarMenuButton
                              size="lg"
                              className="min-w-0 flex-1"
                              aria-label={
                                entry.reviewId
                                  ? `${entry.title}, ${entry.reviewed} of ${entry.total} decisions reviewed, ${reviewListMeta(entry, Date.now())}, ${entry.environmentName}, ${entry.badges.map((badge) => badge.label).join(', ')}`
                                  : undefined
                              }
                              disabled={!entry.reviewId && entry.disabled}
                              isActive={
                                !closed &&
                                entry.worktreeId !== undefined &&
                                selected?.worktreeId === entry.worktreeId &&
                                (selected?.remote ??
                                  connection.environmentId) ===
                                  entry.environmentId
                              }
                              onClick={() =>
                                entry.reviewId
                                  ? setOpenMobile(false)
                                  : openWorktree(entry)
                              }
                              render={
                                entry.reviewId ? (
                                  <Link
                                    to="/reviews/$reviewId"
                                    params={{ reviewId: entry.reviewId }}
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
                                <div className="flex min-w-0 items-center gap-1">
                                  <span
                                    className="min-w-0 flex-1 truncate"
                                    title={entry.title}
                                  >
                                    {entry.title}
                                  </span>
                                  {entry.reviewId ? (
                                    <span
                                      className="shrink-0 text-xs text-muted-foreground"
                                      aria-label={`${entry.reviewed} of ${entry.total} decisions reviewed`}
                                    >
                                      {entry.reviewed}/{entry.total}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                  {signal ? (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <span
                                            role="img"
                                            aria-label="Review status"
                                            className="inline-flex shrink-0"
                                          />
                                        }
                                      >
                                        <indicator.Icon
                                          aria-hidden
                                          className={indicator.className}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div>
                                          <p>
                                            {reviewListMeta(entry, Date.now())}
                                          </p>
                                          {entry.badges.length ? (
                                            entry.badges.map((badge) => (
                                              <p key={badge.label}>
                                                {badge.label}
                                              </p>
                                            ))
                                          ) : (
                                            <p>{signal.reason}</p>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                  <span
                                    className="min-w-0 flex-1 truncate"
                                    title={entry.branch}
                                  >
                                    {entry.branch}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="max-w-1/2"
                                    title={entry.environmentName}
                                  >
                                    <span className="truncate">
                                      {entry.environmentName}
                                    </span>
                                  </Badge>
                                </div>
                              </div>
                            </SidebarMenuButton>
                            {entry.archivable && entry.reviewId ? (
                              <ArchiveReview
                                connection={
                                  connections.find(
                                    (source) =>
                                      source.environmentId ===
                                      entry.environmentId,
                                  ) ?? connection
                                }
                                reviewId={entry.reviewId}
                              />
                            ) : null}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          })}
          {!loading && rows.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{emptyLabel}</EmptyTitle>
                <EmptyDescription>
                  Try another search or clear the filters.
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
            <Button variant="ghost" onClick={() => retry(undefined)}>
              Read again
            </Button>
          )}
        </SidebarContent>
        <footer className="flex shrink-0 flex-wrap items-center gap-1 border-t p-2">
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <SettingsIcon />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts"
            onClick={onOpenShortcuts}
          >
            <KeyboardIcon />
          </Button>
          {remotes?.map(({ remote }) => (
            <Button
              key={remote.environmentId}
              variant="ghost"
              size="sm"
              onClick={() => onOpenRemotes(remote.environmentId)}
            >
              {remote.name}
            </Button>
          ))}
        </footer>
      </Sidebar>
    </div>
  );
}
