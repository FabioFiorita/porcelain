import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  ArrowLeftIcon,
  CopyIcon,
  GitBranchIcon,
  MonitorIcon,
  PaletteIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  ServerIcon,
  SmartphoneIcon,
  UnplugIcon,
  type LucideIcon,
} from 'lucide-react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useRef, type ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
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
  DisconnectBrowser,
  RemoteComputers,
  ServiceUpdateSettings,
  useAccessStore,
  WaysInSettings,
} from '@/features/access/index';
import { usePreferences, type Preferences } from '@/features/preferences/index';
import { useInventory } from '@/features/projects/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { desktopShell } from '@/shared/shell';
import { copyText } from '@/shared/workspace/copy';

const mcpCommand = 'claude mcp add porcelain -- porcelain mcp';

export const settingsSections: readonly {
  id: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'git', label: 'Git and agents', icon: GitBranchIcon },
  ...(desktopShell
    ? [
        { id: 'computer', label: 'This computer', icon: MonitorIcon },
        { id: 'ways-in', label: 'Ways in', icon: RadioTowerIcon },
        { id: 'devices', label: 'Devices', icon: SmartphoneIcon },
        { id: 'remotes', label: 'Remote computers', icon: ServerIcon },
        { id: 'connection', label: 'Connection', icon: UnplugIcon },
      ]
    : [
        { id: 'connection', label: 'Connection', icon: UnplugIcon },
        { id: 'updates', label: 'Updates', icon: RefreshCwIcon },
      ]),
];

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

function SpecFilesSetting() {
  const { preferences, setPreference } = usePreferences();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Spec files</ItemTitle>
        <ItemDescription>
          Group them after the other files and start them collapsed.
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
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Porcelain MCP server</ItemTitle>
        <ItemDescription>
          Agents read and add comments, read reviewed marks, and upload their
          handoff through it. It runs on this machine and needs no credential.
          Add it to Codex or Claude Code with{' '}
          <code className="font-mono">{mcpCommand}</code>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Copy MCP configuration"
          onClick={() => copyText(mcpCommand, 'MCP configuration')}
        >
          <CopyIcon />
        </Button>
      </ItemActions>
    </Item>
  );
}

function useEnvironment() {
  const connection = useAccessStore((state) => state.connection);
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
          <FieldSet>
            <FieldLegend variant="label">Agents</FieldLegend>
            <ItemGroup>
              <AgentsSetting />
            </ItemGroup>
          </FieldSet>
        </>
      );
    case 'connection':
      return (
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <DisconnectBrowser />
            </ItemContent>
          </Item>
        </ItemGroup>
      );
    case 'computer':
      return <ComputerSection />;
    case 'ways-in':
      return <WaysInSettings />;
    case 'devices':
      return <DevicesSection />;
    case 'remotes':
      return <RemoteComputers />;
    case 'updates':
      return (
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ServiceUpdateSettings />
            </ItemContent>
          </Item>
        </ItemGroup>
      );
    default:
      return (
        <>
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-6">
        {children}
      </div>
    </ScrollArea>
  );
}

export function SettingsPage({ section }: { section: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const page = useRef<HTMLElement>(null);
  const connection = useAccessStore((state) => state.connection);
  const { environment } = useInventory(connection);
  useDocumentTitle(
    environment.custom ? `Settings · ${environment.name}` : 'Settings',
  );
  const current =
    settingsSections.find((item) => item.id === section) ?? settingsSections[0];
  const leave = () => {
    if (canGoBack) router.history.back();
    else void navigate({ to: '/' });
  };
  useHotkey('Escape', leave, { target: page, ignoreInputs: true });
  return (
    <div className="h-svh min-w-0 flex-1 bg-muted text-[13px] text-foreground md:p-2">
      <main
        ref={page}
        aria-label="Settings"
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background md:flex-row md:rounded-xl md:border md:bg-card"
      >
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-col border-b md:w-60 md:border-r md:border-b-0"
        >
          <header className="desktop-sidebar-header flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-semibold">Porcelain</span>
              <span
                className="truncate text-xs text-muted-foreground"
                title={`Connected to ${environment.name}`}
              >
                {environment.name}
              </span>
            </div>
          </header>
          <div className="flex gap-1 overflow-x-auto p-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
            {settingsSections.map((item) => {
              const Icon = item.icon;
              const selected = current?.id === item.id;
              return (
                <Button
                  key={item.id}
                  variant={selected ? 'secondary' : 'ghost'}
                  size="sm"
                  className="shrink-0 justify-start md:w-full"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() =>
                    void navigate({
                      to: '/settings/$section',
                      params: { section: item.id },
                      replace: true,
                    })
                  }
                >
                  <Icon />
                  {item.label}
                </Button>
              );
            })}
          </div>
          <footer className="flex shrink-0 items-center border-t p-2">
            <Button
              variant="ghost"
              className="min-w-0 flex-1 justify-start"
              onClick={leave}
            >
              <ArrowLeftIcon />
              Back
            </Button>
          </footer>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-11 shrink-0 items-center border-b px-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>Settings</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <h2>
                    <BreadcrumbPage>{current?.label}</BreadcrumbPage>
                  </h2>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <SectionFrame>
            <SectionContent section={current?.id ?? 'appearance'} />
          </SectionFrame>
        </div>
      </main>
    </div>
  );
}
