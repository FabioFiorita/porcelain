import { useElement } from '@/shared/hooks/use-element';
import {
  ArrowLeftIcon,
  GitBranchIcon,
  SlidersHorizontalIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react';
import { useHotkey } from '@tanstack/react-hotkeys';
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
import { NavigatorHeader, useInventory } from '@/features/projects/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
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

function SectionFrame({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="settings-content mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
        {children}
      </div>
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
  useDocumentTitle(
    environment.custom ? `Settings · ${environment.name}` : 'Settings',
  );
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
    <div className="h-svh min-w-0 flex-1 bg-muted p-2 text-ui text-foreground">
      <main
        ref={attachPage}
        tabIndex={-1}
        aria-label="Settings"
        className="flex h-full min-h-0 min-w-0 flex-col gap-2 md:flex-row"
      >
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-col overflow-hidden rounded-xl border bg-card md:w-66"
        >
          <NavigatorHeader environment={environment.name} />
          <div className="flex gap-1 overflow-x-auto p-2 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
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
          <footer className="flex shrink-0 flex-col items-start gap-2 p-2">
            <Button
              variant="ghost"
              className="h-8 min-w-0 flex-1 justify-start"
              onClick={leave}
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              Porcelain {import.meta.env.PORCELAIN_VERSION} · Esc to close
            </p>
          </footer>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <header className="flex h-11 shrink-0 items-center border-b px-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>Settings</BreadcrumbItem>
                <BreadcrumbSeparator />
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
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{detailName}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          {current.id === 'computers' ? (
            <>
              <div
                ref={attachList}
                className={
                  environmentId === undefined
                    ? 'min-h-0 flex-1 overflow-y-auto'
                    : 'hidden'
                }
                role="region"
                aria-label="Computers list"
                tabIndex={-1}
              >
                <div className="settings-content mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
                  <RemoteComputers
                    showUpdates={environmentId === undefined}
                    environment={environment}
                    onOpen={openRemote}
                  />
                </div>
              </div>
              {environmentId !== undefined && (
                <SectionFrame>
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
            <SectionFrame>
              {current.id === 'git' ? (
                <ReviewsGitSettings />
              ) : (
                <GeneralSettings />
              )}
            </SectionFrame>
          )}
        </div>
      </main>
    </div>
  );
}
