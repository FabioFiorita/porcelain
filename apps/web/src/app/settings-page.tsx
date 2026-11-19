import { useElement } from '@/shared/hooks/use-element';
import {
  GitBranchIcon,
  SlidersHorizontalIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useAtomSet } from '@effect/atom-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebar } from '@/components/ui/sidebar';
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
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { cn } from '@/shared/lib/utils';
import { navigatorFocusPending } from '@/shared/store';
import {
  goThen,
  recordSettingsSession,
  settingsEntry,
  type SettingsSession,
} from './settings-history';

type SettingsSection = { id: string; label: string; icon: LucideIcon };

const settingsSections: readonly [SettingsSection, ...SettingsSection[]] = [
  { id: 'general', label: 'General', icon: SlidersHorizontalIcon },
  { id: 'git', label: 'Changes & Git', icon: GitBranchIcon },
  { id: 'computers', label: 'Computers', icon: ServerIcon },
];

export const defaultSettingsSection = settingsSections[0].id;

export function settingsTarget(
  section: string,
  environmentId: string | undefined,
) {
  if (!settingsSections.some((item) => item.id === section)) return undefined;
  if (environmentId !== undefined && section !== 'computers') return undefined;
  return { section, environmentId };
}

function togglesNavigator(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}) {
  return event.key.toLowerCase() === 'b' && (event.ctrlKey || event.metaKey);
}

function settingsPlace(pathname: string) {
  const [, root, section, environmentId, extra] = pathname.split('/');
  if (root !== 'settings' || section === undefined || extra !== undefined)
    return undefined;
  return settingsTarget(
    section,
    environmentId === '' ? undefined : environmentId,
  );
}

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

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select') !== null)
  );
}

function overlayPress(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('[data-slot=dialog-overlay]') !== null
  );
}

export function SettingsDialog({
  section,
  environmentId,
}: {
  section: string;
  environmentId: string | undefined;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { isMobile } = useSidebar();
  const [origin] = useState<SettingsSession>(() => {
    const entry = settingsEntry(router.history);
    const navigator =
      isMobile && document.querySelector('[data-mobile="true"]') !== null;
    return (
      entry.session ?? {
        start: entry.index,
        workspace: canGoBack,
        ...(navigator ? { navigator } : {}),
      }
    );
  });
  const session = () => {
    const entry = settingsEntry(router.history);
    return { index: entry.index, ...(entry.session ?? origin) };
  };
  useDocumentTitle('Settings — Porcelain');
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
      ? document.activeElement
      : null,
  );
  const setNavigatorFocusPending = useAtomSet(navigatorFocusPending);
  const attachSession = (element: HTMLElement | null) => {
    if (!element) return;
    setNavigatorFocusPending(false);
    let previous: { index: number; list: boolean } | undefined;
    const record = (forward: boolean) => {
      const entry = settingsEntry(router.history);
      const place = settingsPlace(entry.pathname);
      if (!place) return;
      if (entry.session?.retired && forward) {
        router.history.back();
        return;
      }
      if (entry.session) {
        previous = {
          index: entry.index,
          list:
            place.section === 'computers' && place.environmentId === undefined,
        };
        return;
      }
      const fromList =
        place.environmentId !== undefined &&
        previous?.list === true &&
        previous.index === entry.index - 1;
      recordSettingsSession(router.history, {
        start: origin.start,
        workspace: origin.workspace,
        ...(origin.navigator ? { navigator: true } : {}),
        ...(fromList && previous ? { list: previous.index } : {}),
      });
    };
    record(false);
    const stop = router.history.subscribe(({ action }) =>
      record(
        action.type === 'FORWARD' || (action.type === 'GO' && action.index > 0),
      ),
    );
    return () => {
      stop();
      queueMicrotask(() => {
        if (element.isConnected) return;
        if (origin.navigator && isMobile) {
          setNavigatorFocusPending(true);
          return;
        }
        const focused = document.activeElement;
        if (focused === null || focused === document.body)
          opener?.focus({ preventScroll: true });
      });
    };
  };
  const remote = useRemoteConnection(environmentId ?? '')?.remote;
  const { element: list, attach: setList } = useElement<HTMLDivElement>();
  const [listReturn, setListReturn] = useState<{
    scroll: number;
    focus: HTMLElement | null;
  } | null>(null);
  const returnToList = () => {
    const { index, list } = session();
    if (list !== undefined) router.history.go(list - index);
    else
      void navigate({
        to: '/settings/$section',
        params: { section: 'computers' },
        replace: true,
      });
  };
  const showSection = (id: string) => {
    const { index, list } = session();
    const replace = () =>
      void navigate({
        to: '/settings/$section',
        params: { section: id },
        replace: true,
      });
    if (environmentId !== undefined && list !== undefined) {
      const { index: _detail, ...detail } = session();
      recordSettingsSession(router.history, { ...detail, retired: true });
      goThen(router.history, list - index, replace);
    } else replace();
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
  const attachList = (element: HTMLDivElement | null) => {
    setList(element);
    if (environmentId === undefined && element) {
      if (listReturn) element.scrollTop = listReturn.scroll;
      const target = listReturn?.focus;
      const focus = target?.isConnected ? target : element;
      focus.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (document.activeElement?.getAttribute('role') === 'dialog')
          focus.focus({ preventScroll: true });
      });
    }
  };
  const attachPopup = (element: HTMLDivElement | null) => {
    if (environmentId !== undefined) element?.focus({ preventScroll: true });
  };
  const { connection } = useConnectedContext();
  const { environment } = useInventory(connection);
  const current =
    settingsSections.find((item) => item.id === section) ?? settingsSections[0];
  let detailName: ReactNode = 'Computer unavailable';
  if (environmentId === 'this-computer') detailName = 'This computer';
  else if (remote) detailName = <RemoteComputerName remote={remote} />;
  const leave = () => {
    const { index, start, workspace } = session();
    if (workspace) router.history.go(start - 1 - index);
    else
      goThen(
        router.history,
        start - index,
        () => void navigate({ to: '/', replace: true }),
      );
  };
  return (
    <Dialog
      open
      onOpenChange={(next, details) => {
        if (next) return;
        if (details.reason === 'escape-key') {
          if (typing(details.event.target)) return;
          if (environmentId !== undefined) {
            returnToList();
            return;
          }
        }
        if (
          details.reason === 'outside-press' &&
          !overlayPress(details.event.target)
        )
          return;
        leave();
      }}
    >
      <DialogContent
        ref={attachPopup}
        finalFocus={false}
        onKeyDown={(event) => {
          if (togglesNavigator(event)) event.stopPropagation();
        }}
        aria-label="Settings"
        className="flex h-[min(48rem,calc(100svh-2rem))] w-[min(64rem,calc(100vw-2rem))] max-w-none flex-col overflow-hidden sm:max-w-none"
      >
        <div className="-m-4 flex min-h-0 flex-1 flex-col bg-card text-base text-card-foreground">
          <header
            ref={attachSession}
            className="settings-bar flex min-h-12 shrink-0 items-center gap-2 border-b pr-12 pl-4"
          >
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
                      variant={selected ? 'secondary' : 'ghost'}
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
                        showSection(item.id);
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
