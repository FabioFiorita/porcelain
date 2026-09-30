import {
  ArrowLeftIcon,
  CopyIcon,
  GitBranchIcon,
  PaletteIcon,
  RefreshCwIcon,
  Share2Icon,
  UnplugIcon,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommitModelSetting } from '@/app/commit-model-setting';
import {
  DisconnectBrowser,
  ServiceUpdateSettings,
  ShareSettings,
  useAccessStore,
} from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import { desktopShell } from '@/shared/shell';
import { copyText } from '@/shared/workspace/copy';
import type { Preferences } from '@/shared/workspace/preferences';
import { usePreferences } from '@/shared/workspace/preferences';

const mcpCommand = 'claude mcp add porcelain -- porcelain mcp';

const items: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'git', label: 'Git and agents', icon: GitBranchIcon },
  { id: 'updates', label: 'Updates', icon: RefreshCwIcon },
  { id: 'connection', label: 'Connection', icon: UnplugIcon },
  ...(desktopShell
    ? [{ id: 'sharing', label: 'Sharing', icon: Share2Icon }]
    : []),
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Tabs
        value={preferences[name]}
        onValueChange={(value) => {
          const selected = options.find((option) => option.value === value);
          if (selected) setPreference(name, selected.value);
        }}
        className="shrink-0"
      >
        <TabsList className="w-full sm:w-56">
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="flex-1"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

function SpecFilesSetting() {
  const { preferences, setPreference } = usePreferences();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm font-medium">Spec files</p>
        <p className="text-xs text-muted-foreground">
          Group them after the other files and start them collapsed.
        </p>
      </div>
      <Switch
        aria-label="Spec files"
        checked={preferences.collapseSpecs}
        onCheckedChange={(checked) => setPreference('collapseSpecs', checked)}
      />
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      {title && (
        <h3 className="px-1 text-sm font-medium text-foreground/70">{title}</h3>
      )}
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card *:px-4 *:py-3">
        {children}
      </div>
    </section>
  );
}

function Page({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="h-full">
      <ScrollArea className="h-full">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-6">
          <h2 className="text-base font-medium">{title}</h2>
          {children}
        </div>
      </ScrollArea>
    </section>
  );
}

function SharingSection() {
  const connection = useAccessStore((state) => state.connection);
  const { environment } = useInventory(connection);
  return <ShareSettings environment={environment} />;
}

function leaveSettings(
  navigate: ReturnType<typeof useNavigate>,
  projectId: string,
  worktreeId: string,
) {
  if (window.history.length > 1) window.history.back();
  else
    void navigate({
      to: '/$projectId/$worktreeId',
      params: { projectId, worktreeId },
    });
}

export function SettingsPage({
  projectId,
  worktreeId,
}: {
  projectId: string;
  worktreeId: string;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const connection = useAccessStore((state) => state.connection);
  const { environment } = useInventory(connection);
  const [current, setCurrent] = useState(items[0]?.id ?? 'appearance');
  const frameRef = useRef<HTMLDivElement>(null);
  const show = (id: string) => {
    setCurrent(id);
    frameRef.current
      ?.querySelector(`#${CSS.escape(id)}`)
      ?.scrollIntoView({ block: 'start' });
  };
  const leave = () => leaveSettings(navigate, projectId, worktreeId);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      leaveSettings(navigate, projectId, worktreeId);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [navigate, projectId, worktreeId]);
  const page = (
    <div
      role="dialog"
      aria-label="Settings"
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden bg-background text-sm text-foreground',
        isMobile
          ? 'fixed inset-0 z-[60] h-dvh'
          : 'h-full rounded-xl border bg-card',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-col border-b md:w-60 md:border-r md:border-b-0"
        >
          <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-semibold">Porcelain</span>
              <span
                className="truncate text-[11px] text-muted-foreground"
                title={`Connected to ${environment.name}`}
              >
                {environment.name}
              </span>
            </div>
          </header>
          <div className="flex gap-1 overflow-x-auto p-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
            {items.map((item) => {
              const Icon = item.icon;
              const selected = current === item.id;
              return (
                <Button
                  key={item.id}
                  variant={selected ? 'secondary' : 'ghost'}
                  size="sm"
                  className="shrink-0 justify-start md:w-full"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => show(item.id)}
                >
                  <Icon />
                  {item.label}
                </Button>
              );
            })}
          </div>
          <footer className="flex shrink-0 items-center gap-1 border-t p-2">
            <Button
              variant="ghost"
              className="h-8 min-w-0 flex-1 justify-start"
              onClick={leave}
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
          </footer>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-11 items-center border-b px-6">
            <h2 className="font-heading text-base leading-none font-medium">
              Settings
            </h2>
          </header>
          <div ref={frameRef} className="min-h-0 flex-1 overflow-hidden">
            <Page id="appearance" title="Appearance">
              <Group>
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
              </Group>
              <Group title="Code">
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
              </Group>
              <Group title="Documents">
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
              </Group>
            </Page>
            <Page id="git" title="Git and agents">
              <Group title="Git">
                <Choice
                  label="Pull strategy"
                  description="Used by Pull in the Git menu."
                  name="pullStrategy"
                  options={[
                    { value: 'merge', label: 'Merge' },
                    { value: 'rebase', label: 'Rebase' },
                  ]}
                />
                <CommitModelSetting />
              </Group>
              <Group title="Agents">
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Agents read and add comments, read reviewed marks, and
                    upload their handoff through the Porcelain MCP server. It
                    runs on this machine and needs no credential. Add it to
                    Codex or Claude Code:
                  </p>
                  <div className="relative rounded-lg border bg-muted/50">
                    <pre className="overflow-x-auto p-3 font-mono text-[11.5px]">
                      {mcpCommand}
                    </pre>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="absolute top-1.5 right-1.5"
                      aria-label="Copy MCP configuration"
                      onClick={() => copyText(mcpCommand, 'MCP configuration')}
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                </div>
              </Group>
            </Page>
            <Page id="updates" title="Updates">
              <Group>
                <ServiceUpdateSettings />
              </Group>
            </Page>
            <Page id="connection" title="Connection">
              <Group>
                <DisconnectBrowser />
              </Group>
            </Page>
            {desktopShell && (
              <Page id="sharing" title="Sharing">
                <Group>
                  <SharingSection />
                </Group>
              </Page>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  return isMobile ? createPortal(page, document.body) : page;
}
