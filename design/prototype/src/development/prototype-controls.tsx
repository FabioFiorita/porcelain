import { FlaskConical } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { createMockControls } from '../api/mock-controls';
import type { MockStore } from '../api/mock-store';
import { parseEntry } from '../domain/documents';

/**
 * Not product UI. Lets a demo show what only a real agent, Git or the network
 * would cause. Every change reaches the app over the mock live channel, exactly as
 * the server's watchers would announce it.
 */
export function PrototypeControls({ store }: { store: MockStore }) {
  const controls = useMemo(() => createMockControls(store), [store]);
  const [slow, setSlow] = useState(false);
  const [agentClis, setAgentClis] = useState(true);
  const params = () => new URLSearchParams(location.search);
  const worktree = () => params().get('worktree');
  const project = () => {
    const id = worktree();
    return (
      store.projects.find((entry) =>
        entry.worktrees.some((candidate) => candidate.id === id),
      )?.id ?? null
    );
  };
  const say = (title: string, description?: string) =>
    toast.add({ title, description });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            aria-label="Prototype controls"
            className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 gap-1.5 rounded-full border-dashed bg-background/90 text-xs shadow-sm backdrop-blur max-md:left-3 max-md:translate-x-0 max-md:px-2"
          />
        }
      >
        <FlaskConical className="size-3.5" />
        <span className="max-md:sr-only">Prototype</span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-84 gap-0 rounded-2xl p-0 text-sm">
        <div className="border-b px-3 py-2.5">
          <p className="font-medium">Prototype controls</p>
          <p className="text-xs text-muted-foreground">
            What the agent, Git and the network would do. Everything resets on
            reload.
          </p>
        </div>
        <ScrollArea className="max-h-[min(34rem,70vh)]">
          <div className="flex flex-col gap-3 p-3">
            <Group title="Agent: comments">
              <Control
                label="Reads comments and replies"
                onClick={() => {
                  const id = worktree();
                  const answered =
                    id == null ? 0 : controls.agentRepliesToComments(id);
                  say(
                    answered === 0
                      ? 'Nothing waiting for the agent'
                      : 'The agent replied',
                    answered === 0
                      ? 'Comment or reply first: the agent answers threads where you spoke last.'
                      : `${answered} thread${answered === 1 ? '' : 's'} answered. The worktree's dot turns yellow until you read them.`,
                  );
                }}
              />
              <Control
                label="Explains how something was done"
                onClick={() => {
                  const id = worktree();
                  const added =
                    id == null ? [] : controls.agentAddsComments(id);
                  say(
                    added.length === 0
                      ? 'The agent found nothing new to comment on'
                      : `The agent added ${added.length} comment${added.length === 1 ? '' : 's'}`,
                    added.length === 0
                      ? 'Every changed block already has a thread.'
                      : added.join(' · '),
                  );
                }}
              />
            </Group>
            <Group title="Agent: code and review">
              <Control
                label="Adds lines above a step"
                hint="Steps and comments move with the code; a layer tick holds."
                onClick={() => {
                  const id = worktree();
                  const path = id == null ? null : controls.agentMovesCode(id);
                  say(
                    path == null
                      ? 'No review here'
                      : 'The agent moved code down',
                    path ?? 'Pick a worktree with a review.',
                  );
                }}
              />
              <Control
                label="Rewrites code inside a step"
                hint="The step reads “Code changed since the review”; its layer tick goes stale."
                onClick={() => {
                  const id = worktree();
                  const step =
                    id == null ? null : controls.agentRewritesStep(id);
                  say(
                    step == null
                      ? 'No step to rewrite'
                      : 'The agent rewrote a step',
                    step ?? 'Pick a worktree with a review.',
                  );
                }}
              />
              <Control
                label="Publishes the review again"
                onClick={() => {
                  const id = worktree();
                  const revision =
                    id == null ? null : controls.agentRepublishes(id);
                  say(
                    revision == null
                      ? 'No review here'
                      : `Review revision ${revision}`,
                    revision == null
                      ? undefined
                      : 'Steps point at the code as it is now.',
                  );
                }}
              />
              <Control
                label="Commits the first layer itself"
                hint="Outside Porcelain: its steps fold as Committed; History gains a commit."
                onClick={() => {
                  const id = worktree();
                  const title =
                    id == null ? null : controls.agentCommitsFirstLayer(id);
                  say(
                    title == null ? 'Nothing to commit' : 'The agent committed',
                    title ?? 'Pick a worktree with a review.',
                  );
                }}
              />
              <Control
                label="Edits the open file"
                onClick={() => {
                  const id = worktree();
                  const ref = [params().get('entry'), params().get('side')]
                    .map((entry) => parseEntry(entry ?? undefined))
                    .find(
                      (entry) =>
                        entry?.kind === 'file' || entry?.kind === 'change',
                    );
                  const path =
                    id == null || ref == null || !('path' in ref)
                      ? null
                      : controls.agentEditsFile(id, ref.path);
                  say(
                    path == null
                      ? 'No readable file is open'
                      : 'The agent changed the open file',
                    path ?? 'Open a text file or a diff first.',
                  );
                }}
              />
              <Control
                label="Rebases its branch"
                hint="History restarts from the top when an older page is gone."
                onClick={() => {
                  const id = worktree();
                  say(
                    id != null && controls.agentRewritesHistory(id)
                      ? 'The agent rewrote history'
                      : 'No history here',
                  );
                }}
              />
              <Control
                label="Creates a worktree"
                hint="It shows up in the sidebar with no refresh."
                onClick={() => {
                  const id = project();
                  const branch =
                    id == null ? null : controls.agentCreatesWorktree(id);
                  say(
                    branch == null
                      ? 'Pick a worktree of an available project'
                      : 'New worktree',
                    branch ?? undefined,
                  );
                }}
              />
            </Group>
            <Group title="Git">
              <Control
                label="Next pull stops on a conflict"
                hint="The agent commits to the README here while the upstream changed it too. Then Git menu → Pull with merge (or rebase)."
                onClick={() => {
                  const id = worktree();
                  const path =
                    id == null ? null : controls.nextPullConflicts(id);
                  say(
                    path == null
                      ? 'Nothing to set up here'
                      : 'The branch diverged',
                    path == null
                      ? 'Needs a branch with an upstream, a README without edits, and no merge in progress.'
                      : `Both sides changed ${path}: Pull stops on a conflict.`,
                  );
                }}
              />
              <Control
                label="Agent resolves the conflict"
                onClick={() => {
                  const id = worktree();
                  const kind =
                    id == null ? null : controls.agentResolvesConflict(id);
                  say(
                    kind == null
                      ? 'No conflict here'
                      : kind === 'merge'
                        ? 'The agent resolved the conflict'
                        : 'The agent resolved it and continued the rebase',
                    kind === 'merge'
                      ? 'The README keeps both sides. Commit to finish the merge.'
                      : undefined,
                  );
                }}
              />
              <Control
                label="Abort it in a terminal"
                hint="As `git merge --abort` or `git rebase --abort`."
                onClick={() => {
                  const id = worktree();
                  const kind = id == null ? null : controls.abortInTerminal(id);
                  say(
                    kind == null
                      ? 'No merge or rebase in progress'
                      : `The ${kind} was aborted`,
                    kind == null
                      ? undefined
                      : 'Back to before the pull; the branch is still behind.',
                  );
                }}
              />
              <label className="flex items-center justify-between gap-2 px-1 text-xs">
                Server has agent CLIs (commit models)
                <Switch
                  checked={agentClis}
                  onCheckedChange={(checked) => {
                    setAgentClis(checked);
                    controls.setAgentClis(checked);
                    say(
                      checked
                        ? 'Claude Code and Codex are installed'
                        : 'No agent CLI on the server',
                      'Reopen Settings or the commit dialog to see the models.',
                    );
                  }}
                />
              </label>
            </Group>
            <Group title="Server and network">
              <Control
                label="Drop the connection for 3 s"
                onClick={() => {
                  controls.dropConnection();
                  say(
                    'Connection dropped',
                    'The app reconnects and re-checks what is on screen.',
                  );
                }}
              />
              <Control
                label="Restart the server during a push"
                onClick={() => {
                  const id = worktree();
                  say(
                    id != null && controls.serverRestartsDuringPush(id)
                      ? 'The server restarted'
                      : 'Pick a worktree first',
                  );
                }}
              />
              <Control
                label="Revoke this browser"
                hint="As `porcelain revoke` on the server machine."
                onClick={() => {
                  controls.revokeThisDevice();
                  say(
                    'This browser was revoked',
                    'The next request fails and the pairing screen appears.',
                  );
                }}
              />
              <Control
                label="Fail the next request"
                onClick={() => {
                  controls.failNextRequest();
                  say(
                    'The next request will fail',
                    'Open or change something.',
                  );
                }}
              />
              <label className="flex items-center justify-between gap-2 px-1 text-xs">
                Slow network (1.4 s per request)
                <Switch
                  checked={slow}
                  onCheckedChange={(checked) => {
                    setSlow(checked);
                    controls.setSlowNetwork(checked);
                  }}
                />
              </label>
            </Group>
            <Button
              size="sm"
              variant="destructive"
              className="justify-start"
              onClick={() => {
                for (const key of Object.keys(localStorage)) {
                  if (key.startsWith('porcelain.prototype.'))
                    localStorage.removeItem(key);
                }
                sessionStorage.clear();
                location.assign('/');
              }}
            >
              Reset data, tabs and settings
            </Button>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <p className="px-1 text-[11px] font-medium text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

function Control({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-auto flex-col items-start gap-0 py-1.5 text-left"
      onClick={onClick}
    >
      <span>{label}</span>
      {hint != null && (
        <span className="text-[11px] font-normal whitespace-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </Button>
  );
}
