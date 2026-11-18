import { useElement } from '@/shared/hooks/use-element';
import {
  GitBranchIcon,
  SlidersHorizontalIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [open, setOpen] = useState(true);
  const [entry] = useState(() => ({
    historyIndex: router.history.location.state.__TSR_index,
    hasPredecessor: canGoBack,
  }));
  useDocumentTitle('Settings — Porcelain');
  const remote = useRemoteConnection(environmentId ?? '')?.remote;
  const { element: list, attach: setList } = useElement<HTMLDivElement>();
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
    if (entry.hasPredecessor)
      router.history.go(
        -Math.max(
          1,
          router.history.location.state.__TSR_index - entry.historyIndex + 1,
        ),
      );
    else void navigate({ to: '/' });
  };
  return (
    <Dialog
      open={open}
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
        setOpen(false);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) leave();
      }}
    >
      <DialogContent
        ref={attachPopup}
        aria-label="Settings"
        className="flex h-[min(48rem,calc(100svh-2rem))] w-[min(64rem,calc(100vw-2rem))] max-w-none flex-col overflow-hidden sm:max-w-none"
      >
        <div className="-m-4 flex min-h-0 flex-1 flex-col bg-card text-sm text-card-foreground">
          <header className="settings-bar flex min-h-12 shrink-0 items-center gap-2 border-b pr-12 pl-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
