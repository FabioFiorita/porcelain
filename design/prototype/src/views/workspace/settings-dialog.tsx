import { format, formatDistanceToNowStrict } from 'date-fns';
import { Copy, MonitorX, RotateCcw, Settings } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Preferences } from '../../contracts/preferences';
import { groupedCommitModels, resolveCommitModel } from '../../domain/models';
import { useForgetDevice, useSession } from '../../query/connection';
import { useCommitModels } from '../../query/git-actions';
import { reviewErrorMessage } from '../../query/review';
import { ReviewBoundary } from '../review/review-boundary';
import { copyText } from './copy';
import { DialogIcon } from './dialog-icon';
import { usePreferences } from './preferences';

/**
 * Agents run on the server machine and reach Porcelain through `porcelain mcp`,
 * which talks to the server over its local socket: no URL, no token.
 */
const CLAUDE_CODE_COMMAND = 'claude mcp add porcelain -- porcelain mcp';
const CODEX_CONFIG = `[mcp_servers.porcelain]
command = "porcelain"
args = ["mcp"]`;

/** Every toggle has this width, however many options it has, so the column lines up. */
const CHOICE_WIDTH = 'w-72';

function Choice<K extends keyof Preferences>({
  label,
  description,
  name,
  options,
  fitLabels = false,
}: {
  label: string;
  description: string;
  name: K;
  options: { value: Preferences[K]; label: string }[];
  /** Options share the width by their label's length instead of equally, for one long label. */
  fitLabels?: boolean;
}) {
  const { preferences, setPreference } = usePreferences();
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Tabs
        value={preferences[name]}
        onValueChange={(value) => setPreference(name, value as Preferences[K])}
        className="shrink-0"
      >
        <TabsList className={CHOICE_WIDTH}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={fitLabels ? 'flex-auto px-2' : 'flex-1 px-0'}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/**
 * Same row shape and width as `Choice`, with a select: there are too many models for
 * tabs. The list is what the server's agent CLIs can run, so it can be empty.
 */
function ModelChoice() {
  const { preferences, setPreference } = usePreferences();
  const { models, isPending, error, refetch } = useCommitModels();
  const selected =
    models == null ? null : resolveCommitModel(models, preferences.commitModel);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium">Commit model</p>
          <p className="text-xs text-muted-foreground">
            Drafts messages and groups in the commit dialog.
          </p>
        </div>
        {isPending ? (
          <p
            className={`${CHOICE_WIDTH} flex h-8 shrink-0 items-center gap-2 px-2.5 text-xs text-muted-foreground`}
          >
            <Spinner className="size-3.5" />
            Asking the server for its models…
          </p>
        ) : models == null ? (
          <div
            className={`${CHOICE_WIDTH} flex shrink-0 items-center justify-between gap-2 pl-2.5 text-xs text-destructive`}
          >
            <span className="truncate" title={reviewErrorMessage(error)}>
              Couldn’t load the models.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => void refetch()}
            >
              <RotateCcw />
              Retry
            </Button>
          </div>
        ) : selected == null ? (
          <p
            className={`${CHOICE_WIDTH} flex h-8 shrink-0 items-center px-2.5 text-xs text-muted-foreground`}
          >
            None on the server
          </p>
        ) : (
          <Select
            value={selected}
            onValueChange={(value) =>
              value != null && setPreference('commitModel', value)
            }
            items={models.map((model) => ({
              value: model.id,
              label: model.label,
            }))}
          >
            <SelectTrigger
              className={`${CHOICE_WIDTH} shrink-0`}
              aria-label="Commit model"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupedCommitModels(models).map((group) => (
                <SelectGroup key={group.provider}>
                  <SelectLabel>{group.provider}</SelectLabel>
                  {group.models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {models?.length === 0 && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          No agent CLI on the server. Install and sign in to Claude Code or
          Codex on the server machine to draft commit messages and groups.
          Writing messages yourself works either way.
        </p>
      )}
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

/** A command or config file to paste somewhere else, with Copy. */
function Snippet({
  label,
  text,
  copyLabel,
}: {
  label: string;
  text: string;
  copyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12.5px] font-medium">{label}</p>
      <div className="relative rounded-lg border bg-muted/50">
        <pre className="overflow-x-auto py-2.5 pr-11 pl-3 font-mono text-[11.5px] leading-relaxed">
          {text}
        </pre>
        <Button
          size="icon-sm"
          variant="ghost"
          className="absolute top-1 right-1"
          aria-label={`Copy the ${copyLabel}`}
          title={`Copy the ${copyLabel}`}
          onClick={() => copyText(text, copyLabel)}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm">{children}</dd>
    </div>
  );
}

/** Which browser this is to the server, and the server it talks to. */
function ThisDevice() {
  const { device, server } = useSession();
  const [forgetting, setForgetting] = useState(false);
  const paired = new Date(device.pairedAt);
  return (
    <>
      <dl className="flex flex-col gap-2">
        <Detail label="Name">{device.label}</Detail>
        <Detail label="Paired">
          <span title={format(paired, 'PPpp')}>
            {format(paired, 'PP')} ·{' '}
            {formatDistanceToNowStrict(paired, { addSuffix: true })}
          </span>
        </Detail>
        <Detail label="Server">
          {server.name}{' '}
          <span className="text-muted-foreground">
            · Porcelain {server.version}
          </span>
        </Detail>
      </dl>
      <div className="flex items-center justify-between gap-6">
        <p className="text-xs text-muted-foreground">
          This browser stops working with Porcelain until it is paired again
          with a new link.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={() => setForgetting(true)}
        >
          <MonitorX className="size-3.5" />
          Forget this browser
        </Button>
      </div>
      <ForgetDeviceDialog
        open={forgetting}
        onOpenChange={setForgetting}
        serverName={server.name}
      />
    </>
  );
}

function ForgetDeviceDialog({
  open,
  onOpenChange,
  serverName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
}) {
  const forget = useForgetDevice();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) forget.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <MonitorX />
          </AlertDialogMedia>
          <AlertDialogTitle>Forget this browser?</AlertDialogTitle>
          <AlertDialogDescription>
            {serverName} stops answering it. To use Porcelain here again, run{' '}
            <code className="font-mono">porcelain pair</code> on the server
            machine and paste the new link. Your comments and reviewed marks
            stay on the server.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {forget.error != null && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {reviewErrorMessage(forget.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* On success the pairing screen replaces the whole app, this dialog included. */}
          <Button
            variant="destructive"
            disabled={forget.isPending}
            onClick={() => forget.submit().catch(() => undefined)}
          >
            {forget.isPending ? <Spinner /> : <MonitorX />}
            Forget this browser
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ThisDevicePending() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <DialogIcon icon={Settings} />
          <div className="flex flex-col gap-0.5">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Preferences are kept in this browser.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Only the body scrolls (shadcn ScrollArea); its thin scrollbar sits inside the padding. */}
        <ScrollArea className="-mr-3 min-h-0">
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
                description="Used by Pull. Fast-forward only stops when the branches diverged."
                name="pullStrategy"
                fitLabels
                options={[
                  { value: 'ff-only', label: 'Fast-forward only' },
                  { value: 'merge', label: 'Merge' },
                  { value: 'rebase', label: 'Rebase' },
                ]}
              />
              <ModelChoice />
            </Section>

            <Separator />

            <Section title="Agents">
              <p className="text-xs text-muted-foreground">
                Agents read and answer comments and publish their review through{' '}
                <code className="font-mono">porcelain mcp</code>. It runs on the
                server machine and talks to Porcelain over its local socket, so
                there is no URL or token to set up. Add it once where your
                agents run:
              </p>
              <Snippet
                label="Claude Code"
                text={CLAUDE_CODE_COMMAND}
                copyLabel="Claude Code command"
              />
              <Snippet
                label="Codex, in ~/.codex/config.toml"
                text={CODEX_CONFIG}
                copyLabel="Codex configuration"
              />
            </Section>

            <Separator />

            <Section title="This device">
              <ReviewBoundary fallback={<ThisDevicePending />}>
                <ThisDevice />
              </ReviewBoundary>
            </Section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
