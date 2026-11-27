import { useElement } from '@/shared/hooks/use-element';
import {
  GitBranchIcon,
  SlidersHorizontalIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  useCanGoBack,
  useLocation,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { Fragment, useState, type ReactNode } from 'react';
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
  ComputersOutline,
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
import { plainClick } from '@/shared/views/settings-section';
import { TruncatedText } from '@/shared/views/truncated-text';
import { navigatorFocusPending } from '@/shared/store';
import {
  goThen,
  recordSettingsSession,
  replaceSettingsEntry,
  settingsEntry,
  type SettingsSession,
} from './settings-history';
import {
  useSettingsOutline,
  type SettingsOutlineEntry,
} from './settings-outline';

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

const contentClass =
  'settings-content wrap-anywhere mx-auto flex w-full max-w-200 flex-col gap-8 px-4 py-5 md:px-8 md:py-6';

function SectionFrame({
  attach,
  children,
}: {
  attach: (element: HTMLElement | null) => (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div ref={attach} className={contentClass}>
        {children}
      </div>
    </ScrollArea>
  );
}

function SectionOutline({
  sections,
  active,
  onGo,
}: {
  sections: readonly SettingsOutlineEntry[];
  active: string | undefined;
  onGo: (id: string) => void;
}) {
  if (sections.length < 2) return null;
  return (
    <div className="my-0.5 ml-4.5 flex flex-col border-l">
      {sections.map(({ id, title }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? 'location' : undefined}
          onClick={(event) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            onGo(id);
          }}
          className={cn(
            '-ml-px flex h-6 min-w-0 items-center border-l border-transparent pr-2 pl-3 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30',
            active === id && 'border-foreground font-medium text-foreground',
          )}
        >
          <TruncatedText text={title} className="min-w-0" />
        </a>
      ))}
    </div>
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
    target.closest('[data-slot=dialog-backdrop]') !== null
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
  const showComputer = (id: string) => {
    if (current.id === 'computers' && environmentId === undefined) {
      openRemote(id);
      return;
    }
    if (id === environmentId) return;
    const { index: _index, ...kept } = session();
    replaceSettingsEntry(
      router.history,
      router.buildLocation({
        to: '/settings/$section/$environmentId',
        params: { section: 'computers', environmentId: id },
      }).href,
      kept,
    );
  };
  const place = useLocation({ select: (location) => location.pathname });
  const hash = useLocation({ select: (location) => location.hash });
  const outline = useSettingsOutline(place, hash);
  const sectionOutline = (
    <SectionOutline
      sections={outline.sections}
      active={outline.active}
      onGo={outline.go}
    />
  );
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
          if (typing(details.event?.target ?? null)) return;
          if (environmentId !== undefined) {
            returnToList();
            return;
          }
        }
        if (
          details.reason === 'outside-press' &&
          !overlayPress(details.event?.target ?? null)
        )
          return;
        leave();
      }}
    >
      <DialogContent
        ref={attachPopup}
        finalFocus="none"
        onKeyDown={(event) => {
          if (togglesNavigator(event)) event.stopPropagation();
        }}
        aria-label="Settings"
        className="flex h-[min(48rem,calc(100svh-2rem))] w-[min(64rem,calc(100vw-2rem))] max-w-none flex-col overflow-clip sm:max-w-none"
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
                  {environmentId === undefined ? (
                    <h2>
                      <BreadcrumbPage>{current.label}</BreadcrumbPage>
                    </h2>
                  ) : (
                    <BreadcrumbLink
                      render={<button type="button" onClick={returnToList} />}
                    >
                      Computers
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {environmentId !== undefined && (
                  <>
                    <BreadcrumbSeparator>/</BreadcrumbSeparator>
                    <BreadcrumbItem className="min-w-0">
                      <h2 className="min-w-0">
                        <BreadcrumbPage className="min-w-0">
                          {detailName}
                        </BreadcrumbPage>
                      </h2>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <nav
              aria-label="Settings sections"
              className="flex shrink-0 flex-col md:min-h-0 md:w-56"
            >
              <div className="settings-nav flex gap-0.5 overflow-x-auto px-3 py-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:py-4">
                {settingsSections.map((item) => {
                  const Icon = item.icon;
                  const here = current.id === item.id;
                  const selected = here && environmentId === undefined;
                  return (
                    <Fragment key={item.id}>
                      <Button
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
                      {item.id === 'computers' ? (
                        <div className="hidden pl-4 md:mb-1 md:block">
                          <ComputersOutline
                            selected={environmentId}
                            onOpen={showComputer}
                          >
                            {sectionOutline}
                          </ComputersOutline>
                        </div>
                      ) : (
                        here && (
                          <div className="hidden md:mb-1 md:block">
                            {sectionOutline}
                          </div>
                        )
                      )}
                    </Fragment>
                  );
                })}
              </div>
              <p className="hidden shrink-0 px-5 py-3 text-xs tabular-nums text-muted-foreground md:block">
                Porcelain {import.meta.env.PORCELAIN_VERSION}
              </p>
            </nav>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:border-l">
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
                    <div className={contentClass}>
                      <RemoteComputers
                        showUpdates={environmentId === undefined}
                        environment={environment}
                        onOpen={openRemote}
                      />
                    </div>
                  </div>
                  {environmentId !== undefined && (
                    <SectionFrame key={environmentId} attach={outline.attach}>
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
                <SectionFrame key={current.id} attach={outline.attach}>
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
