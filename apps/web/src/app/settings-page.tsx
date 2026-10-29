import { useElement } from '@/shared/hooks/use-element';
import {
  XIcon,
  GitBranchIcon,
  SlidersHorizontalIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react';
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ComputerSettings,
  RemoteComputers,
  RemoteComputerSettings,
  RemoteComputerName,
  useRemoteConnection,
  useConnectedContext,
} from '@/features/access/index';
import {
  GeneralSettings,
  ReviewsGitSettings,
} from '@/features/preferences/index';
import { useInventory } from '@/features/projects/index';
import { cn } from '@/shared/lib/utils';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

type SettingsSection = { id: string; label: string; icon: LucideIcon };

export const settingsSections: readonly [
  SettingsSection,
  ...SettingsSection[],
] = [
  { id: 'general', label: 'General', icon: SlidersHorizontalIcon },
  { id: 'git', label: 'Reviews & Git', icon: GitBranchIcon },
  { id: 'computers', label: 'Computers', icon: ServerIcon },
];

export const defaultSettingsSection = settingsSections[0].id;

type ContentLayout = 'reading' | 'list' | 'wide';

const contentLayouts: Record<ContentLayout, string> = {
  reading: 'max-w-186 gap-8',
  list: 'max-w-186 gap-7',
  wide: 'max-w-240 gap-5.5 md:pt-7.5',
};

function contentClass(layout: ContentLayout) {
  return cn(
    'settings-content wrap-anywhere mx-auto flex w-full flex-col px-4 py-6 md:px-6 md:py-9 lg:pr-10 lg:pl-6',
    contentLayouts[layout],
  );
}

function SectionFrame({
  children,
  layout,
}: {
  children: ReactNode;
  layout: ContentLayout;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className={contentClass(layout)}>{children}</div>
    </ScrollArea>
  );
}

export function SettingsPage({
  section,
  environmentId,
}: {
  section: string;
  environmentId?: string | undefined;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [entry] = useState(() => ({
    historyIndex: router.history.location.state.__TSR_index,
    hasPredecessor: canGoBack,
  }));
  const remote = useRemoteConnection(environmentId ?? '')?.remote;
  const { element: list, attach: setList } = useElement<HTMLDivElement>();
  const { element: page, attach: setPage } = useElement<HTMLElement>();
  const [listReturn, setListReturn] = useState<{
    scroll: number;
    focus: HTMLElement | null;
  } | null>(null);
  const returnToList = () => {
    if (listReturn) router.history.back();
    else
      void navigate({
        to: '/settings/$section',
        params: { section: 'computers' },
        replace: true,
      });
  };
  const openRemote = (id: string) => {
    setListReturn({
      scroll: list?.scrollTop ?? 0,
      focus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    });
    void navigate({
      to: '/settings/$section/$environmentId',
      params: { section: 'computers', environmentId: id },
    });
  };
  const attachPage = (element: HTMLElement | null) => {
    setPage(element);
    if (environmentId !== undefined) element?.focus({ preventScroll: true });
  };
  const attachList = (element: HTMLDivElement | null) => {
    setList(element);
    if (environmentId === undefined && element) {
      if (listReturn) element.scrollTop = listReturn.scroll;
      const target = listReturn?.focus;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else element.focus({ preventScroll: true });
    }
  };
  const { connection } = useConnectedContext();
  const { environment } = useInventory(connection);
  const current =
    settingsSections.find((item) => item.id === section) ?? settingsSections[0];
  let detailName: ReactNode = 'Computer unavailable';
  if (environmentId === 'this-computer') detailName = 'This computer';
  else if (remote) detailName = <RemoteComputerName remote={remote} />;
  const leave = () => {
    if (environmentId !== undefined) returnToList();
    else if (entry.hasPredecessor)
      router.history.go(
        -Math.max(
          1,
          router.history.location.state.__TSR_index - entry.historyIndex + 1,
        ),
      );
    else void navigate({ to: '/' });
  };
  useHotkey(SHORTCUTS.closeSettings, leave, {
    target: page,
    ignoreInputs: true,
  });
  return (
    <main
      ref={attachPage}
      tabIndex={-1}
      aria-label="Settings"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-paper bg-card shadow-paper outline-none"
    >
      <header className="settings-bar flex min-h-12 shrink-0 items-center gap-2 border-b px-2">
        <Tooltip>
          <TooltipTrigger
            render={<SidebarTrigger aria-label="Toggle Sidebar" />}
          />
          <TooltipContent>
            Toggle sidebar{' '}
            <Kbd>{formatForDisplay(SHORTCUTS.toggleNavigator)}</Kbd>
          </TooltipContent>
        </Tooltip>
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="min-w-0 flex-nowrap">
            <BreadcrumbItem>Settings</BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <h2>
                {environmentId === undefined ? (
                  <BreadcrumbPage>{current.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<button type="button" onClick={returnToList} />}
                  >
                    Computers
                  </BreadcrumbLink>
                )}
              </h2>
            </BreadcrumbItem>
            {environmentId !== undefined && (
              <>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="min-w-0">
                    {detailName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={leave}
          aria-label="Close Settings"
        >
          <XIcon />
          <span className="hidden sm:inline">Close</span>
          <Kbd>{formatForDisplay(SHORTCUTS.closeSettings)}</Kbd>
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-col md:w-52"
        >
          <div className="settings-nav flex gap-0.5 overflow-x-auto px-3 py-3 md:flex-col md:py-5">
            {settingsSections.map((item) => {
              const Icon = item.icon;
              const selected = current.id === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className="shrink-0 justify-start md:w-full"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => {
                    if (
                      environmentId !== undefined &&
                      item.id === 'computers'
                    ) {
                      returnToList();
                      return;
                    }
                    void navigate({
                      to: '/settings/$section',
                      params: { section: item.id },
                      replace: true,
                    });
                  }}
                >
                  <Icon />
                  {item.label}
                </Button>
              );
            })}
          </div>
          <p className="mt-auto hidden px-5 pb-4 text-xs tabular-nums text-muted-foreground md:block">
            Porcelain {import.meta.env.PORCELAIN_VERSION}
          </p>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {current.id === 'computers' ? (
            <>
              <div
                ref={attachList}
                className={
                  environmentId === undefined
                    ? 'min-h-0 flex-1 overflow-y-auto outline-none'
                    : 'hidden'
                }
                role="region"
                aria-label="Computers list"
                tabIndex={-1}
              >
                <div className={contentClass('list')}>
                  <RemoteComputers
                    showUpdates={environmentId === undefined}
                    environment={environment}
                    onOpen={openRemote}
                  />
                </div>
              </div>
              {environmentId !== undefined && (
                <SectionFrame layout="wide">
                  {environmentId === 'this-computer' ? (
                    <ComputerSettings environment={environment} />
                  ) : (
                    <RemoteComputerSettings
                      key={environmentId}
                      environmentId={environmentId}
                      onForgotten={returnToList}
                    />
                  )}
                </SectionFrame>
              )}
            </>
          ) : (
            <SectionFrame layout="reading">
              {current.id === 'git' ? (
                <ReviewsGitSettings />
              ) : (
                <GeneralSettings />
              )}
            </SectionFrame>
          )}
        </div>
      </div>
    </main>
  );
}
