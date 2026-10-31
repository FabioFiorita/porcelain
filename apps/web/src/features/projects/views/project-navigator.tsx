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
  navigatorCardReviewLabel,
  navigatorCardChangesLabel,
  navigatorChecksLabel,
  navigatorDiffSummary,
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
import { SwitchWorktreeBranchDialog } from './switch-worktree-branch';
import { DeleteWorktreeDialog } from './delete-worktree';
import { ProjectActions } from './project-actions';
import { NavigatorHeader } from './navigator-header';
import { OpenProjectMenu } from './open-project-menu';

const checkTones = {
  passed: 'text-add-fg group-hover/button:text-add-fg/70',
  running: 'text-warn group-hover/button:text-warn/70',
  failed: 'text-del-fg group-hover/button:text-del-fg/70',
  none: 'text-muted-foreground group-hover/button:text-foreground',
} as const;

type Props = {
  remotes: readonly RemoteConnection[] | undefined;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  openReview: { reviewId: string; environment: string | undefined } | undefined;
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
  openReview,
  onSelect,
  onOpenPullRequest,
  onOpenProject,
  onOpenSettings,
  settingsOpen,
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
  const { projects, filters, loading, messages } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const state = useAtomValue(worktreeNavigatorState);
  const setState = useAtomSet(worktreeNavigatorState);
  const { query, filter } = state;
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
  const { setOpenMobile, isMobile } = useSidebar();
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
              aria-label="Search reviews and worktrees"
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
                <DropdownMenuCheckboxItem
                  className="cursor-pointer"
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
                    aria-label={`${source.project.name} · ${source.environmentName}`}
                    className="min-w-0 flex-1"
                  >
                    <TruncatedText text={source.project.name} />
                  </SidebarGroupLabel>
                  {connections.length > 1 && (
                    <Badge
                      variant="secondary"
                      className="max-w-20"
                      role="img"
                      aria-label={`Computer: ${source.environmentName}`}
                    >
                      <MonitorIcon />
                      <TruncatedText
                        text={source.environmentName}
                        className="min-w-0"
                      />
                    </Badge>
                  )}
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
                        entry.review.state === 'available'
                          ? entry.review
                          : undefined;
                      const checkResult =
                        review?.checks?.state === 'available'
                          ? review.checks.result
                          : 'none';
                      const summary = navigatorDiffSummary(entry.changes);
                      const retained = entry.kind === 'review';
                      const detail = navigatorCardReviewLabel(entry);
                      const changes = retained
                        ? ''
                        : navigatorCardChangesLabel(entry.changes);
                      const openRetained =
                        retained || (!entry.available && review !== undefined);
                      let attach =
                        entry.key === lastKey ? lastEntry.attach : undefined;
                      if (entry.key === firstKey) attach = firstEntry.attach;
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
                                    onClick={() =>
                                      openRetained
                                        ? setOpenMobile(false)
                                        : openWorktree(entry)
                                    }
                                    render={
                                      openRetained && review ? (
                                        <Link
                                          ref={attach}
                                          to="/reviews/$reviewId"
                                          params={{
                                            reviewId: review.reviewId,
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
                                      ) : (
                                        <button
                                          type="button"
                                          ref={attach}
                                          disabled={
                                            !openRetained && !entry.available
                                          }
                                        />
                                      )
                                    }
                                  />
                                  <Item
                                    size="xs"
                                    className="pointer-events-none"
                                  >
                                    <ItemContent className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1">
                                        {clip(
                                          entry.name,
                                          active
                                            ? 'min-w-0 flex-1 font-semibold'
                                            : 'min-w-0 flex-1 font-medium',
                                        )}
                                        {entry.detached && (
                                          <span className="text-xs text-muted-foreground">
                                            Detached
                                          </span>
                                        )}
                                        {review?.pullRequestNumber && (
                                          <Button
                                            variant="ghost"
                                            size="xs"
                                            className="relative pointer-events-auto cursor-pointer"
                                            aria-label={`Open PR #${review.pullRequestNumber} · ${entry.projectName} · ${entry.environmentName} · ${navigatorChecksLabel(review.checks)}`}
                                            onClick={() => {
                                              onOpenPullRequest(entry);
                                              setOpenMobile(false);
                                            }}
                                          >
                                            <span
                                              className={
                                                checkTones[checkResult]
                                              }
                                            >
                                              PR #{review.pullRequestNumber}
                                            </span>
                                          </Button>
                                        )}
                                      </div>
                                      {(detail || changes) && (
                                        <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                                          {detail &&
                                            clip(detail, 'min-w-0 flex-1')}
                                          {changes && (
                                            <span
                                              className="ml-auto shrink-0"
                                              role="img"
                                              aria-label={`Local uncommitted changes: ${changes}`}
                                            >
                                              {summary ? (
                                                <>
                                                  <span className="text-add-fg">
                                                    +{summary.additions}
                                                  </span>{' '}
                                                  <span className="text-del-fg">
                                                    −{summary.deletions}
                                                  </span>
                                                  {summary.binaryFiles > 0 &&
                                                    ` · ${summary.binaryFiles} binary`}
                                                </>
                                              ) : (
                                                changes
                                              )}
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
