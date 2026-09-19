import { CopyIcon, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommitModelSetting } from './commit-model-setting';
import { copyText } from './copy';
import { DialogIcon } from './dialog-icon';
import type { Preferences } from './preferences';
import { usePreferences } from './preferences';

function mcpConfig() {
  const origin =
    typeof window === 'undefined'
      ? 'http://localhost:8787'
      : window.location.origin;
  return `{
  "mcpServers": {
    "porcelain": {
      "url": "${origin}/api/mcp",
      "headers": {
        "Authorization": "Bearer <Porcelain access token>"
      }
    }
  }
}`;
}

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Tabs
        value={preferences[name]}
        onValueChange={(value) => setPreference(name, value as Preferences[K])}
        className="shrink-0"
      >
        <TabsList className="w-full sm:w-56">
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="flex-1 px-0"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Device-local display preferences supported by the current live client. */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <DialogIcon icon={Settings} />
          <div className="flex flex-col gap-0.5">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Stored on this device.</DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="-mr-3 min-h-0 min-w-0">
          <div className="flex flex-col gap-6 pr-3">
            <Section title="Appearance">
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

            <Separator />

            <Section title="Code">
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

            <Separator />

            <Section title="Documents">
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
            <Separator />
            <Section title="Git">
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

            <Separator />

            <Section title="Agents">
              <p className="text-xs text-muted-foreground">
                Agents read and add comments, read reviewed marks, and upload
                their handoff through the Porcelain MCP server. Add it to Codex
                or Claude Code:
              </p>
              <div className="relative rounded-lg border bg-muted/50">
                <pre className="overflow-x-auto p-3 font-mono text-[11.5px]">
                  {mcpConfig()}
                </pre>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="absolute top-1.5 right-1.5"
                  aria-label="Copy MCP configuration"
                  onClick={() => copyText(mcpConfig(), 'MCP configuration')}
                >
                  <CopyIcon />
                </Button>
              </div>
            </Section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
