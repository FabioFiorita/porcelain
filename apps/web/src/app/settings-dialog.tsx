import {
  BotIcon,
  CodeIcon,
  CopyIcon,
  FileTextIcon,
  GitBranchIcon,
  PaletteIcon,
  RefreshCwIcon,
  Share2Icon,
  UnplugIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const sections: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'code', label: 'Code', icon: CodeIcon },
  { id: 'documents', label: 'Documents', icon: FileTextIcon },
  { id: 'git', label: 'Git', icon: GitBranchIcon },
  { id: 'agents', label: 'Agents', icon: BotIcon },
  ...(desktopShell
    ? [{ id: 'sharing', label: 'Sharing', icon: Share2Icon }]
    : []),
  { id: 'updates', label: 'Updates', icon: RefreshCwIcon },
  { id: 'connection', label: 'Connection', icon: UnplugIcon },
];

function Choice<K extends keyof Preferences>({
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

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex min-h-full flex-col gap-2.5 px-6 py-6">
      <h2 className="px-1 text-sm font-medium text-foreground/70">{title}</h2>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card *:px-4 *:py-3">
        {children}
      </div>
    </section>
  );
}

function SharingSection() {
  const connection = useAccessStore((state) => state.connection);
  const { environment } = useInventory(connection);
  return <ShareSettings environment={environment} />;
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [current, setCurrent] = useState(sections[0]?.id ?? 'appearance');
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = frameRef.current;
    const viewport = frame?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!(viewport instanceof HTMLElement)) return;
    viewport.scrollTop = 0;
    const first = sections[0]?.id;
    if (first) setCurrent(first);
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.intersectionRect.height);
        }
        let bestId = '';
        let bestHeight = 0;
        for (const [id, height] of seen) {
          if (height > bestHeight) {
            bestHeight = height;
            bestId = id;
          }
        }
        if (bestId) {
          setCurrent((selected) => (selected === bestId ? selected : bestId));
        }
      },
      { root: viewport, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const section of sections) {
      const element = frame?.querySelector(`#${CSS.escape(section.id)}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 right-0 bottom-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-none flex-col overflow-hidden sm:max-w-none">
        <div className="-m-6 flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label="Settings sections"
            className="shrink-0 border-b pr-12 md:w-60 md:border-r md:border-b-0 md:pr-0"
          >
            <div className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-y-auto">
              {sections.map((section) => {
                const Icon = section.icon;
                const selected = current === section.id;
                return (
                  <Button
                    key={section.id}
                    variant={selected ? 'secondary' : 'ghost'}
                    size="sm"
                    className="shrink-0 justify-start md:w-full"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => {
                      setCurrent(section.id);
                      frameRef.current
                        ?.querySelector(`#${CSS.escape(section.id)}`)
                        ?.scrollIntoView({ block: 'start' });
                    }}
                  >
                    <Icon />
                    {section.label}
                  </Button>
                );
              })}
            </div>
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex flex-col gap-1 border-b px-6 py-4 pr-14">
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                {desktopShell
                  ? 'Preferences stay in this browser. Sharing changes Porcelain for every device.'
                  : 'Preferences stay in this browser.'}
              </DialogDescription>
            </header>
            <div ref={frameRef} className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="mx-auto h-full w-full max-w-3xl">
                  <Section id="appearance" title="Appearance">
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
                  </Section>
                  <Section id="code" title="Code">
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
                  </Section>
                  <Section id="documents" title="Documents">
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
                  </Section>
                  <Section id="git" title="Git">
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
                  </Section>
                  <Section id="agents" title="Agents">
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-muted-foreground">
                        Agents read and add comments, read reviewed marks, and
                        upload their handoff through the Porcelain MCP server.
                        It runs on this machine and needs no credential. Add it
                        to Codex or Claude Code:
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
                          onClick={() =>
                            copyText(mcpCommand, 'MCP configuration')
                          }
                        >
                          <CopyIcon />
                        </Button>
                      </div>
                    </div>
                  </Section>
                  {desktopShell && (
                    <Section id="sharing" title="Sharing">
                      <SharingSection />
                    </Section>
                  )}
                  <Section id="updates" title="Updates">
                    <ServiceUpdateSettings />
                  </Section>
                  <Section id="connection" title="Connection">
                    <DisconnectBrowser />
                  </Section>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
