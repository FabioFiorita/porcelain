import { archiveSettings } from '@porcelain/client/preferences/rules';
import { useElement } from '@/shared/hooks/use-element';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  ArrowLeftIcon,
  CopyIcon,
  GitBranchIcon,
  SlidersHorizontalIcon,
  BlocksIcon,
  ServerIcon,
  SmartphoneIcon,
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommitModelSetting } from '@/app/commit-model-setting';
import {
  ComputerSettings,
  DevicesSettings,
  RemoteComputers,
  RemoteComputerSettings,
  RemoteComputerName,
  useRemoteConnection,
  useConnectedContext,
  useMcpConfiguration,
} from '@/features/access/index';
import { usePreferences } from '@/features/preferences/index';
import type { Preferences } from '@porcelain/client/preferences';
import { NavigatorHeader, useInventory } from '@/features/projects/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { desktopShell } from '@/shared/shell';
import { copyText } from '@/shared/workspace/copy';

const archiveDescriptions = {
  archiveDeleteWorktree:
    'Removes the review’s folder. The main checkout is never deleted.',
  archiveDeleteLocalBranch: 'Deletes the review branch from this clone.',
  archiveDeleteRemoteBranch: 'Deletes the branch on origin if it still exists.',
};

const mcpCommand = 'claude mcp add porcelain -- porcelain mcp';

type SettingsSection = { id: string; label: string; icon: LucideIcon };

export const settingsSections: readonly [
  SettingsSection,
  ...SettingsSection[],
] = [
  { id: 'general', label: 'General', icon: SlidersHorizontalIcon },
  { id: 'git', label: 'Reviews & Git', icon: GitBranchIcon },
  { id: 'computers', label: 'Computers', icon: ServerIcon },
  { id: 'devices', label: 'Devices', icon: SmartphoneIcon },
  { id: 'integrations', label: 'Integrations', icon: BlocksIcon },
];

export const defaultSettingsSection = settingsSections[0].id;

type ChoiceName = {
  [K in keyof Preferences]: Preferences[K] extends string ? K : never;
}[keyof Preferences];

function Choice<K extends ChoiceName>({
  label,
  description,
  name,
  options,
}: {
  label: string;
  description: string;
  name: K;
  options: { value: Preferences[K]; label: string }[];
}) {
  const { preferences, setPreference } = usePreferences();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Tabs
          value={preferences[name]}
          onValueChange={(value) => {
            const selected = options.find((option) => option.value === value);
            if (selected) setPreference(name, selected.value);
          }}
        >
          <TabsList aria-label={label}>
            {options.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ItemActions>
    </Item>
  );
}

function ArchiveSettings() {
  const { preferences, setPreference } = usePreferences();
  return (
    <FieldSet>
      <FieldLegend variant="label">When archiving a review</FieldLegend>
      <ItemGroup>
        {archiveSettings.map(({ key, label }) => (
          <Item key={key} variant="outline">
            <ItemContent>
              <ItemTitle>{label}</ItemTitle>
              <ItemDescription>{archiveDescriptions[key]}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label={label}
                checked={preferences[key]}
                onCheckedChange={(checked) => setPreference(key, checked)}
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </FieldSet>
  );
}

function SpecFilesSetting() {
  const { preferences, setPreference } = usePreferences();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Spec files</ItemTitle>
        <ItemDescription>
          Group specs separately and start them collapsed.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          aria-label="Spec files"
          checked={preferences.collapseSpecs}
          onCheckedChange={(checked) => setPreference('collapseSpecs', checked)}
        />
      </ItemActions>
    </Item>
  );
}

function AgentsSetting() {
  const { configuration, failed, retry } = useMcpConfiguration();
  const command = desktopShell ? configuration?.command : mcpCommand;
  const status = failed
    ? ' MCP configuration is unavailable.'
    : ' Loading MCP configuration…';
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Porcelain MCP server</ItemTitle>
        <ItemDescription>
          Agents read and add comments, read reviewed marks, and upload their
          handoff through it. It needs no credential.
        </ItemDescription>
        <p className="text-sm text-muted-foreground">
          {desktopShell
            ? "This command connects to this app's local server while the app is running, including when you are viewing a remote computer."
            : 'Run this on the computer hosting your Porcelain server.'}
        </p>
        {desktopShell && configuration && (
          <p className="text-sm text-muted-foreground">
            Local server data:{' '}
            <code className="break-all font-mono">
              {configuration.dataDirectory}
            </code>
            .
          </p>
        )}
        <p className="text-sm">
          {command ? (
            <>
              Add it to Claude Code with{' '}
              <code className="break-all font-mono">{command}</code>
            </>
          ) : (
            status
          )}
        </p>
      </ItemContent>
      <ItemActions>
        {desktopShell && failed && (
          <Button size="sm" variant="outline" onClick={retry}>
            Retry MCP configuration
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Copy MCP configuration"
          disabled={command === undefined}
          onClick={() => {
            if (command !== undefined) copyText(command, 'MCP configuration');
          }}
        >
          <CopyIcon />
        </Button>
      </ItemActions>
    </Item>
  );
}

function useEnvironment() {
  const { connection } = useConnectedContext();
  return useInventory(connection).environment;
}

function ComputerSection() {
  return <ComputerSettings environment={useEnvironment()} />;
}

function DevicesSection() {
  return <DevicesSettings environment={useEnvironment()} />;
}

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case 'git':
      return (
        <>
          <ArchiveSettings />
          <FieldSet>
            <FieldLegend variant="label">Git</FieldLegend>
            <ItemGroup>
              <Choice
                label="Pull strategy"
                description="Used by Pull in the Git menu."
                name="pullStrategy"
                options={[
                  { value: 'merge', label: 'Merge' },
                  { value: 'rebase', label: 'Rebase' },
                ]}
              />
              <Item variant="outline">
                <ItemContent>
                  <CommitModelSetting />
                </ItemContent>
              </Item>
            </ItemGroup>
          </FieldSet>
          <p className="text-xs text-muted-foreground">
            These preferences are saved on this device. Archive and pull actions
            run on the computer hosting the review.
          </p>
        </>
      );
    case 'integrations':
      return (
        <FieldSet>
          <FieldLegend variant="label">Agents</FieldLegend>
          <ItemGroup>
            <AgentsSetting />
          </ItemGroup>
        </FieldSet>
      );
    case 'devices':
      return <DevicesSection />;
    default:
      return (
        <>
          <FieldSet>
            <FieldLegend variant="label">Appearance</FieldLegend>
            <ItemGroup>
              <Choice
                label="Theme"
                description="System follows your operating system."
                name="appearance"
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </ItemGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">Code</FieldLegend>
            <ItemGroup>
              <Choice
                label="Diff layout"
                description="Split shows old and new side by side."
                name="diffStyle"
                options={[
                  { value: 'unified', label: 'Unified' },
                  { value: 'split', label: 'Split' },
                ]}
              />
              <Choice
                label="Long lines"
                description="Wrap keeps every line visible without scrolling."
                name="lineOverflow"
                options={[
                  { value: 'scroll', label: 'Scroll' },
                  { value: 'wrap', label: 'Wrap' },
                ]}
              />
              <SpecFilesSetting />
            </ItemGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">Documents</FieldLegend>
            <ItemGroup>
              <Choice
                label="Markdown opens as"
                description="You can switch per file."
                name="markdownDefault"
                options={[
                  { value: 'reader', label: 'Reader' },
                  { value: 'source', label: 'Source' },
                ]}
              />
              <Choice
                label="HTML opens as"
                description="Previews run in a sandbox with no access to Porcelain."
                name="htmlDefault"
                options={[
                  { value: 'preview', label: 'Preview' },
                  { value: 'source', label: 'Source' },
                ]}
              />
            </ItemGroup>
          </FieldSet>
        </>
      );
  }
}

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
  const remote = useRemoteConnection(environmentId ?? '')?.remote;
  const { element: list, attach: setList } = useElement<HTMLDivElement>();
  const { element: page, attach: setPage } = useElement<HTMLElement>();
  const [listReturn, setListReturn] = useState<{
    scroll: number;
    historyIndex: number;
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
      historyIndex: router.history.location.state.__TSR_index,
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
  const router = useRouter();
  const canGoBack = useCanGoBack();
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
    else if (canGoBack && listReturn)
      router.history.go(
        -(
          router.history.location.state.__TSR_index -
          listReturn.historyIndex +
          1
        ),
      );
    else if (canGoBack) router.history.back();
    else void navigate({ to: '/' });
  };
  useHotkey('Escape', leave, { target: page, ignoreInputs: true });
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
                    environment={environment}
                    onOpen={openRemote}
                  />
                </div>
              </div>
              {environmentId !== undefined && (
                <SectionFrame>
                  {environmentId === 'this-computer' ? (
                    <ComputerSection />
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
              <SectionContent section={current.id} />
            </SectionFrame>
          )}
        </div>
      </main>
    </div>
  );
}
