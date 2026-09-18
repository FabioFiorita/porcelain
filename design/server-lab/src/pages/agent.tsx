import { useMutation } from '@tanstack/react-query';
import { cn } from 'cn';
import { Bot } from 'lucide-react';
import { useState } from 'react';
import { Empty, Section, StatusMark } from '@/components/lab/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { labApi, useLab } from '@/lib/lab';
import { href } from '@/lib/route';
import { useLabStatic } from '@/lib/state';

/** Change a playground worktree the way a coding agent would, then watch the server react. */
export function AgentPage() {
  const { runtime, messages } = useLab();
  const lab = useLabStatic();
  const worktrees = runtime.status === 'ready' ? runtime.worktrees : [];
  const [worktree, setWorktree] = useState<string>();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const target =
    worktrees.find((candidate) => candidate.path === worktree) ??
    worktrees.find((candidate) => candidate.role === 'review') ??
    worktrees[0];
  const act = useMutation({
    mutationFn: (input: { action: string; count?: number }) =>
      labApi<{ message: string }>('/simulate', {
        method: 'POST',
        body: JSON.stringify({ worktree: target?.path, ...input }),
      }),
  });
  if (runtime.status !== 'ready')
    return (
      <div className="p-6">
        <Empty>The server is {runtime.status}.</Empty>
      </div>
    );
  if (runtime.mode.kind === 'real')
    return (
      <div className="p-6">
        <Empty>
          The agent only acts on playgrounds. Real projects are observed, never
          changed.
        </Empty>
      </div>
    );
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <Section
          title={
            <span className="inline-flex items-center gap-2">
              <Bot className="size-4" /> Act like an agent
            </span>
          }
          description="These run from the lab supervisor, outside the traced server, so they never appear as server work. What you see afterwards in the Web + trace page or the benchmarks is how the server reacts to them."
        >
          <div className="flex flex-wrap gap-2">
            {worktrees.map((candidate) => (
              <button
                key={candidate.path}
                type="button"
                onClick={() => setWorktree(candidate.path)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm hover:bg-muted',
                  target?.path === candidate.path &&
                    'bg-muted ring-1 ring-border',
                )}
              >
                {candidate.role} ·{' '}
                <span className="font-mono text-xs">{candidate.branch}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lab.data?.simulationActions.map((action) => (
              <div
                key={action.action}
                className="flex flex-col gap-2 rounded-xl border p-3"
              >
                <div className="text-sm font-medium">{action.title}</div>
                <p className="flex-1 text-xs text-muted-foreground">
                  {action.detail}
                </p>
                <div className="flex items-center gap-2">
                  {action.count && (
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={counts[action.action] ?? 5}
                      onChange={(event) =>
                        setCounts((current) => ({
                          ...current,
                          [action.action]: Number(event.target.value),
                        }))
                      }
                      className="h-7 w-20 text-xs"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({
                        action: action.action,
                        count: counts[action.action] ?? 5,
                      })
                    }
                  >
                    Run
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="What happened"
          description={
            <a
              className="underline-offset-2 hover:underline"
              href={href('web')}
            >
              Open the web next to its trace →
            </a>
          }
        >
          {messages.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <ol className="space-y-1 text-sm">
              {[...messages].reverse().map((message) => (
                <li
                  key={`${message.at}-${message.text}`}
                  className="flex items-center gap-3"
                >
                  <span className="w-20 text-xs tabular-nums text-muted-foreground">
                    {new Date(message.at).toLocaleTimeString()}
                  </span>
                  <StatusMark status={message.ok ? 'ok' : 'danger'}>
                    {message.text}
                  </StatusMark>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
}
