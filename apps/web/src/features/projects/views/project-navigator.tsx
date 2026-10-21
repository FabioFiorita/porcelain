import { useState } from 'react';
import { useAtomValue, useAtomSet } from '@effect/atom-react';
import { Link } from '@tanstack/react-router';
import { FilterIcon, KeyboardIcon, SettingsIcon } from 'lucide-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import {
  emptyReviewListFilter,
  reviewListGroups,
  reviewListMeta,
  reviewListView,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { useConnectedContext } from '@/features/access/index';
import type { RemoteConnection } from '@porcelain/client/access';
import type { Inventory } from '@porcelain/client/projects/rules';
import type { WorktreeTarget } from '../rules/worktree-target';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
  const { rows, projectFilters, environmentFilters } = reviewListView(
    entries,
    query,
    filter,
    closed,
  );
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
    <Sidebar
      role="navigation"
      collapsible="none"
      className="h-full w-full min-h-0 overflow-hidden"
      aria-label="Projects and worktrees"
    >
      <NavigatorHeader environment={inventory.environment.name}>
        <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
      </NavigatorHeader>
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="text-sm font-semibold">
          {closed ? 'Closed reviews' : 'Worktrees'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={closed}
          onClick={() => setClosed(!closed)}
        >
          {closed ? 'Back to reviews' : 'Closed'}
        </Button>
      </div>
      <div className="flex gap-1 p-2">
        <InputGroup>
          <InputGroupInput
            type="search"
            aria-label="Search reviews and worktrees"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="Search reviews or worktrees…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        <DropdownMenu>
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
          <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              {projectFilters.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={option.checked}
                  closeOnClick={false}
                  onCheckedChange={() =>
                    setFilter({ ...filter, projects: option.next })
                  }
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Environments</DropdownMenuLabel>
              {environmentFilters.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={option.checked}
                  closeOnClick={false}
                  onCheckedChange={() =>
                    setFilter({ ...filter, environments: option.next })
                  }
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilter(emptyReviewListFilter)}>
              Clear filters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SidebarContent>
        {loading && (
          <p role="status" className="px-3 text-xs">
            Reading reviews…
          </p>
        )}
        {(closed ? (['Closed'] as const) : reviewListGroups).map((group) => {
          const grouped =
            group === 'Closed'
              ? rows
              : rows.filter((row) => row.group === group);
          if (grouped.length === 0) return null;
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>
                {group} · {grouped.length}
              </SidebarGroupLabel>
              <SidebarMenu>
                {grouped.map((entry) => (
                  <SidebarMenuItem key={entry.key}>
                    <Item
                      size="xs"
                      className="min-w-0 flex-nowrap items-start text-left"
                      render={
                        entry.reviewId ? (
                          <Link
                            to="/reviews/$reviewId"
                            params={{ reviewId: entry.reviewId ?? '' }}
                            search={{
                              environment:
                                entry.environmentId === connection.environmentId
                                  ? undefined
                                  : entry.environmentId,
                              decision: undefined,
                            }}
                            onClick={() => setOpenMobile(false)}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={entry.disabled}
                            aria-current={
                              selected?.worktreeId === entry.worktreeId
                                ? 'page'
                                : undefined
                            }
                            onClick={() => openWorktree(entry)}
                          />
                        )
                      }
                    >
                      {entry.reviewId ? (
                        <ItemMedia>
                          <Badge
                            variant="outline"
                            aria-label={`${entry.reviewed} of ${entry.total} decisions reviewed`}
                          >
                            {entry.reviewed}/{entry.total}
                          </Badge>
                        </ItemMedia>
                      ) : null}
                      <ItemContent className="min-w-0">
                        {group !== 'Projects' ? (
                          <p className="line-clamp-2 text-sm font-medium leading-snug">
                            {entry.title}
                          </p>
                        ) : null}
                        {entry.badges.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.badges.map((badge) => (
                              <Badge key={badge.label} variant={badge.variant}>
                                {badge.label}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={reviewListMeta(entry, Date.now())}
                        >
                          {reviewListMeta(entry, Date.now())}
                        </p>
                      </ItemContent>
                    </Item>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
        {!loading && rows.length === 0 && (
          <p role="status" className="px-3 py-4 text-xs text-muted-foreground">
            {emptyLabel}
          </p>
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
        <Popover>
          <PopoverTrigger render={<Button size="sm" variant="ghost" />}>
            Projects
          </PopoverTrigger>
          <PopoverContent className="max-h-96 overflow-y-auto">
            {projects.length === 0 ? (
              <p>No projects registered</p>
            ) : (
              projects.map((source) => (
                <div
                  role="group"
                  aria-label={
                    source.connection.environmentId === connection.environmentId
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
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
            Worktrees
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-96 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Open a worktree</DropdownMenuLabel>
              <InputGroup>
                <InputGroupInput
                  type="search"
                  aria-label="Search worktrees"
                  placeholder="Search worktrees…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
              {[
                ...new Map(
                  rows
                    .filter((entry) => entry.worktreeId)
                    .map((entry) => [
                      `${entry.environmentId}/${entry.worktreeId}`,
                      entry,
                    ]),
                ).values(),
              ].map((entry) => (
                <DropdownMenuItem
                  key={entry.key}
                  disabled={entry.disabled}
                  onClick={() => openWorktree(entry)}
                >
                  {entry.branch} · {entry.projectName} · {entry.environmentName}
                  {selected?.worktreeId === entry.worktreeId
                    ? ' · Current'
                    : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
  );
}
