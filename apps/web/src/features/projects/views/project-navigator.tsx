import { TruncatedText } from '@/shared/views/truncated-text';
import { NavigatorRowMenu } from './navigator-row-menu';
import { ArchiveReview } from './archive-review';
import { NavigatorStatus } from './navigator-status';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { cn } from '@/shared/lib/utils';
import { useState } from 'react';
import { useElement } from '@/shared/hooks/use-element';
import { useAtomValue, useAtomSet, useAtomMount } from '@effect/atom-react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  FilterIcon,
  FolderCogIcon,
  KeyboardIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import { refreshInventories } from '@porcelain/client/projects';
import {
  emptyReviewListFilter,
  reviewListGroups,
  reviewListMeta,
  reviewListCheckout,
  reviewListRowContext,
  reviewListView,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { UpdatesMenu, useConnectedContext } from '@/features/access/index';
import type { RemoteConnection } from '@porcelain/client/access';
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
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenProject: (remote: RemoteConnection | null) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

export function ProjectNavigator({
  remotes,
  selected,
  onSelect,
  onOpenProject,
  onOpenSettings,
  onOpenShortcuts,
}: Props) {
  const { connection } = useConnectedContext();
  const settingsButton = useElement<HTMLButtonElement>();
  const searchButton = useElement<HTMLButtonElement>();
  const [searching, setSearching] = useState(false);
  const firstCheckout = useElement<HTMLDivElement>();
  const lastCheckout = useElement<HTMLDivElement>();
  const { preferences, setPreference } = usePreferences();
  const connections = [
    connection,
    ...(remotes ?? []).map((entry) => entry.connection),
  ];
  const { entries, loading, messages, projects } = useAtomValue(
    readReviewList(connections),
  );
  useAtomMount(refreshInventories(connections));
  const retry = useAtomSet(refreshReviewList(connections));
  const [view, setView] = useState({
    query: '',
    filter: emptyReviewListFilter,
  });
  const { query, filter } = view;
  const location = useLocation();
  const [menu, setMenu] = useState({
    href: location.href,
    open: false,
    query: '',
  });
  const menuOpen = menu.href === location.href && menu.open;
  const menuQuery = menuOpen ? menu.query : '';
  const setMenuQuery = (query: string) =>
    setMenu((current) => ({ ...current, query }));
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
  const firstCheckoutKey = checkouts.find((entry) => !entry.disabled)?.key;
  const lastCheckoutKey = checkouts.findLast((entry) => !entry.disabled)?.key;
  const setQuery = (query: string) =>
    setView((current) => ({ ...current, query }));
  const setFilter = (filter: typeof emptyReviewListFilter) =>
    setView((current) => ({ ...current, filter }));
  const filtered =
    query.trim() ||
    filter.projects !== undefined ||
    filter.environments !== undefined;
  const emptyLabel =
    projects.length === 0 ? 'No projects registered' : 'No matching worktrees';
  let emptyDescription = filtered
    ? 'Try another search or clear the filters.'
    : 'Open a project to see its worktrees.';
  if (projects.length === 0)
    emptyDescription = 'Open a Git repository to get started.';
  const { rows, filters, multipleProjects } = reviewListView(
    entries,
    query,
    filter,
    false,
  );
  const closedView = reviewListView(entries, query, filter, true);
  const closedRows = closedView.rows;
  const closeSearch = () => {
    setQuery('');
    setSearching(false);
    searchButton.element?.focus();
  };
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
    <div className="h-full min-h-0 overflow-hidden bg-frame text-ui [--sidebar:var(--frame)] [--sidebar-foreground:var(--foreground)]">
      <Sidebar
        role="navigation"
        collapsible="none"
        className="h-full w-full min-h-0 overflow-hidden"
        aria-label="Projects and worktrees"
      >
        <NavigatorHeader>
          <OpenProjectMenu remotes={remotes} onOpenProject={onOpenProject} />
        </NavigatorHeader>
        <div className="flex items-center gap-1 px-2 py-1">
          {searching && (
            <InputGroup className="h-7 min-w-0 flex-1">
              <InputGroupInput
                autoFocus
                type="search"
                aria-label="Search reviews and worktrees"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closeSearch();
                  }
                }}
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          )}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size={searching ? 'icon-sm' : 'xs'}
                        className="h-7 shrink-0"
                        aria-label="Manage projects"
                      />
                    }
                  />
                }
              >
                {searching ? (
                  <FolderCogIcon className="text-muted-foreground" />
                ) : (
                  <span className="font-normal text-muted-foreground">
                    Manage projects
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent>Manage projects</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
            >
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
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu
            highlightItemOnHover={false}
            open={menuOpen}
            onOpenChange={(open) =>
              setMenu({ href: location.href, open, query: '' })
            }
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant={filtered ? 'secondary' : 'ghost'}
                        size={searching || filtered ? 'icon-sm' : 'xs'}
                        className={cn(
                          'h-7',
                          !searching &&
                            !filtered &&
                            'min-w-0 flex-1 justify-start',
                        )}
                        aria-label="Filter reviews"
                      />
                    }
                  />
                }
              >
                {searching || filtered ? (
                  <FilterIcon className="text-muted-foreground" />
                ) : (
                  <>
                    <span className="text-caption text-foreground">All</span>
                    <ChevronDownIcon className="ml-auto" />
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent role="tooltip">Filter reviews</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="max-h-96 w-80 min-w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
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
                            setFilter({ ...filter, [section.key]: option.next })
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
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowUp'
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            const target =
                              event.key === 'ArrowDown' ||
                              firstCheckoutKey === lastCheckoutKey
                                ? firstCheckout.element
                                : lastCheckout.element;
                            if (firstCheckoutKey !== undefined) target?.focus();
                            return;
                          }
                          if (!['Escape', 'Tab'].includes(event.key))
                            event.stopPropagation();
                        }}
                      />
                      <InputGroupAddon>
                        <SearchIcon />
                      </InputGroupAddon>
                    </InputGroup>
                    <DropdownMenuRadioGroup value={currentCheckout?.key ?? ''}>
                      {checkouts.map((entry) => {
                        const checkoutTarget =
                          entry.key === firstCheckoutKey
                            ? firstCheckout
                            : lastCheckout;
                        const attach =
                          entry.key === firstCheckoutKey ||
                          entry.key === lastCheckoutKey
                            ? checkoutTarget.attach
                            : undefined;
                        const checkout = reviewListCheckout(entry);
                        const full = `${checkout.full} · ${entry.projectName}`;
                        return (
                          <TruncatedText
                            propagateEscape
                            key={entry.key}
                            text={`${full} · ${entry.environmentName}`}
                            disclose={checkout.parent ? 'always' : 'clipped'}
                            className="max-w-full shrink-0"
                            renderTrigger={(label, clip) => (
                              <DropdownMenuRadioItem
                                ref={attach}
                                value={entry.key}
                                closeOnClick
                                disabled={entry.disabled}
                                aria-label={`${full} ${entry.environmentName}`}
                                onClick={() => openWorktree(entry)}
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                  {label}
                                  {clip(`· ${entry.projectName}`)}
                                  {checkout.parent
                                    ? clip(
                                        checkout.parent,
                                        'flex-1 text-muted-foreground',
                                        'start',
                                      )
                                    : null}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="max-w-1/2"
                                >
                                  {clip(entry.environmentName)}
                                </Badge>
                              </DropdownMenuRadioItem>
                            )}
                          >
                            {checkout.name}
                          </TruncatedText>
                        );
                      })}
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
                  ref={(element) => searchButton.attach(element)}
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto size-7"
                  aria-label={
                    searching ? 'Close search' : 'Search reviews and worktrees'
                  }
                  aria-expanded={searching}
                  onClick={() =>
                    searching ? closeSearch() : setSearching(true)
                  }
                />
              }
            >
              {searching ? (
                <XIcon className="text-muted-foreground" />
              ) : (
                <SearchIcon className="text-muted-foreground" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {searching ? 'Close search' : 'Search reviews and worktrees'}
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
          <div className="flex flex-col -space-y-1">
            {[
              ...reviewListGroups.filter((group) => group !== 'Projects'),
              'Closed' as const,
            ].map((group) => {
              const grouped =
                group === 'Closed'
                  ? closedRows
                  : rows.filter(
                      (row) =>
                        row.group === group ||
                        (group === 'No review' && row.group === 'Projects'),
                    );
              if (grouped.length === 0 && group !== 'Closed') return null;
              return (
                <SidebarGroup key={group}>
                  <Collapsible
                    open={
                      preferences.reviewListGroupOpen[group] ??
                      group !== 'Closed'
                    }
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
                      aria-label={
                        group === 'Closed' ? 'Closed reviews' : undefined
                      }
                      className="h-7 w-full cursor-pointer"
                    >
                      {group} · {grouped.length}
                      <ChevronDownIcon className="ml-auto group-data-closed/review-list:-rotate-90" />
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      {group === 'Closed' &&
                        grouped.length === 0 &&
                        !loading &&
                        messages.length === 0 && (
                          <p className="px-2 py-3 text-caption text-muted-foreground">
                            {filtered
                              ? 'No matching closed reviews'
                              : 'No closed reviews'}
                          </p>
                        )}
                      <SidebarMenu>
                        {grouped.map((entry) => {
                          const context = reviewListRowContext(
                            entry,
                            group === 'Closed'
                              ? closedView.multipleProjects
                              : multipleProjects,
                          );
                          const checkout = reviewListCheckout(entry);
                          const detachedLabel = context.location
                            ? `${checkout.full} ${entry.projectName}`
                            : undefined;
                          const active =
                            !entry.closed &&
                            entry.worktreeId !== undefined &&
                            selected?.worktreeId === entry.worktreeId &&
                            (selected?.remote ?? connection.environmentId) ===
                              entry.environmentId;
                          return (
                            <SidebarMenuItem
                              key={entry.key}
                              className="flex items-center"
                            >
                              <NavigatorRowMenu
                                entry={entry}
                                connection={
                                  connections.find(
                                    (source) =>
                                      source.environmentId ===
                                      entry.environmentId,
                                  ) ?? connection
                                }
                                onRetry={() => retry(undefined)}
                                beforeLeave={() => setOpenMobile(false)}
                              >
                                <div
                                  className={cn(
                                    'flex min-w-0 flex-1 items-center rounded-xl',
                                    active && 'bg-sidebar-row shadow-row',
                                  )}
                                >
                                  <NavigatorStatus entry={entry} />
                                  <SidebarMenuButton
                                    size="lg"
                                    className="h-10 min-w-0 flex-1"
                                    aria-label={
                                      entry.reviewId
                                        ? `${entry.title}, ${entry.reviewed} of ${entry.total} decisions reviewed, ${reviewListMeta(entry, Date.now())}, ${entry.badges.map((badge) => badge.label).join(', ')}`
                                        : detachedLabel
                                    }
                                    disabled={!entry.reviewId && entry.disabled}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() =>
                                      entry.reviewId
                                        ? setOpenMobile(false)
                                        : openWorktree(entry)
                                    }
                                    render={
                                      entry.reviewId ? (
                                        <Link
                                          to="/reviews/$reviewId"
                                          params={{
                                            reviewId: entry.reviewId,
                                          }}
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
                                    <div className="min-w-0 flex-1 text-ui leading-4">
                                      <div className="flex min-w-0 items-center gap-1">
                                        <TruncatedText
                                          className="min-w-0 flex-1"
                                          text={entry.title}
                                        />
                                        {entry.reviewId ? (
                                          <span
                                            className={cn(
                                              'shrink-0 text-xs',
                                              active
                                                ? 'text-brand'
                                                : 'text-muted-foreground',
                                            )}
                                            aria-label={`${entry.reviewed} of ${entry.total} decisions reviewed`}
                                          >
                                            {entry.reviewed}/{entry.total}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                        <div className="flex min-w-0 flex-1 items-center gap-1">
                                          {context.project ? (
                                            <TruncatedText
                                              className={
                                                context.branch ||
                                                context.location
                                                  ? 'min-w-0 max-w-1/2 '
                                                  : 'min-w-0 flex-1 '
                                              }
                                              text={context.project}
                                            />
                                          ) : null}
                                          {context.branch ? (
                                            <TruncatedText
                                              className="min-w-0 flex-1"
                                              text={context.branch}
                                            />
                                          ) : null}
                                          {context.location ? (
                                            <TruncatedText
                                              cut="start"
                                              disclose="always"
                                              className="min-w-0 flex-1"
                                              text={checkout.full}
                                            >
                                              {context.location}
                                            </TruncatedText>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </SidebarMenuButton>
                                </div>
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
                                    beforeLeave={() => setOpenMobile(false)}
                                  />
                                ) : null}
                              </NavigatorRowMenu>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarGroup>
              );
            })}
          </div>
          {!loading &&
            messages.length === 0 &&
            rows.length === 0 &&
            closedRows.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{emptyLabel}</EmptyTitle>
                  <EmptyDescription>{emptyDescription}</EmptyDescription>
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
          className="flex shrink-0 items-center gap-1 border-t p-2"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  ref={(element) => settingsButton.attach(element)}
                  variant="ghost"
                  size="sm"
                  onClick={onOpenSettings}
                />
              }
            >
              <SettingsIcon />
              Settings
            </TooltipTrigger>
            <TooltipContent role="tooltip">
              Settings <Kbd>{formatForDisplay(SHORTCUTS.openSettings)}</Kbd>
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <UpdatesMenu fallbackFocus={settingsButton} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Keyboard shortcuts"
                    onClick={onOpenShortcuts}
                  />
                }
              >
                <KeyboardIcon />
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
