import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { Eye, EyeOff, Gauge, Play, Ruler, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { describeMode } from '@/app';
import { Empty, Section, StatusMark } from '@/components/lab/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { count, ms } from '@/lib/format';
import {
  type BenchRun,
  type Budget,
  labApi,
  type RuntimeMode,
  startRuntime,
  useLab,
} from '@/lib/lab';
import {
  realNamesShown,
  setRealNamesShown,
  useBenchRuns,
  useLabStatic,
  useRepositories,
} from '@/lib/state';
import type { RepoShape } from '../../host/protocol';

export function ScalePage() {
  const [showNames, setShowNames] = useState(realNamesShown);
  const repositories = useRepositories();
  const alias = (path: string) => {
    const index =
      repositories.data?.repositories.findIndex((repo) => repo.path === path) ??
      -1;
    const repo = repositories.data?.repositories[index];
    return showNames && repo ? repo.name : `Local repository ${index + 1}`;
  };
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <RuntimeSwitcher
          alias={alias}
          showNames={showNames}
          onToggleNames={() => {
            setRealNamesShown(!showNames);
            setShowNames(!showNames);
          }}
        />
        <ShapeComparison alias={alias} />
        <Benchmarks alias={alias} />
      </div>
    </div>
  );
}

function RuntimeSwitcher({
  alias,
  showNames,
  onToggleNames,
}: {
  alias: (path: string) => string;
  showNames: boolean;
  onToggleNames: () => void;
}) {
  const { runtime } = useLab();
  const lab = useLabStatic();
  const repositories = useRepositories();
  const [real, setReal] = useState<Set<string>>(new Set());
  const profiles = Object.entries(lab.data?.profiles ?? {});
  const active =
    runtime.status !== 'stopped' && runtime.mode.kind === 'playground'
      ? runtime.mode.profile
      : undefined;
  return (
    <Section
      title="What the server runs against"
      description="Each switch restarts the real server in a fresh process with its own disposable state. Playgrounds are generated repositories; real projects are observed read-only."
      actions={
        <span className="text-xs text-muted-foreground">
          Now:{' '}
          <b className="font-medium text-foreground">{describeMode(runtime)}</b>{' '}
          · {runtime.status}
          {runtime.status === 'ready' && ` · started in ${ms(runtime.readyMs)}`}
        </span>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        {profiles.map(([id, profile]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              void startRuntime({ kind: 'playground', profile: id })
            }
            className={cn(
              'rounded-xl border p-3 text-left hover:bg-muted',
              active === id && 'ring-2 ring-foreground/20',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{profile.label ?? id}</span>
              {active === id && (
                <span className="text-xs text-muted-foreground">running</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.description}
            </p>
            {profile.targets && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs tabular-nums">
                {Object.entries(profile.targets)
                  .filter(([, value]) => typeof value === 'number')
                  .slice(0, 8)
                  .map(([name, value]) => (
                    <div key={name} className="flex justify-between gap-2">
                      <dt className="truncate text-muted-foreground">{name}</dt>
                      <dd>{count(value as number)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </button>
        ))}
      </div>
      <div className="rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="size-4 text-[var(--lab-danger)]" />
          <span className="font-medium">Real projects, read-only</span>
          <span className="text-sm text-muted-foreground">
            from {lab.data?.realRoots.join(', ')}. Review data goes to a
            throwaway directory; Git actions, file edits and AI drafts are
            refused.
          </span>
          <span className="flex-1" />
          <Button size="xs" variant="ghost" onClick={onToggleNames}>
            {showNames ? <EyeOff /> : <Eye />}{' '}
            {showNames ? 'Hide names' : 'Show names'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {repositories.data?.repositories.map((repo) => (
            <label
              key={repo.path}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm"
            >
              <input
                type="checkbox"
                checked={real.has(repo.path)}
                onChange={() =>
                  setReal((current) => {
                    const next = new Set(current);
                    if (next.has(repo.path)) next.delete(repo.path);
                    else next.add(repo.path);
                    return next;
                  })
                }
              />
              {alias(repo.path)}
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={real.size === 0}
            onClick={() =>
              void startRuntime({ kind: 'real', repositories: [...real] })
            }
          >
            Observe {real.size || ''} read-only
          </Button>
        </div>
      </div>
      {runtime.status !== 'stopped' && runtime.status !== 'ready' && (
        <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
          {runtime.status === 'failed' && `${runtime.error}\n\n`}
          {runtime.log.join('\n')}
        </pre>
      )}
    </Section>
  );
}

const shapeRows: [keyof RepoShape, string][] = [
  ['trackedFiles', 'Tracked files'],
  ['directories', 'Directories'],
  ['trackedMb', 'Tracked MB'],
  ['sizeP90', 'File size p90 (bytes)'],
  ['over1Mb', 'Files over 1 MB'],
  ['binaryFiles', 'Binary files'],
  ['depthMax', 'Deepest path'],
  ['packages', 'package.json files'],
  ['commits', 'Commits on HEAD'],
  ['remoteBranches', 'Remote branches'],
  ['worktrees', 'Worktrees'],
  ['changedEntries', 'Changed entries per worktree'],
  ['workingTreeFiles', 'Files on disk (incl. ignored)'],
];

function ShapeComparison({ alias }: { alias: (path: string) => string }) {
  const { runtime } = useLab();
  const repositories = useRepositories();
  const [shapes, setShapes] = useState<Record<string, RepoShape>>({});
  const [busy, setBusy] = useState<string>();
  const playground =
    runtime.status === 'ready' && runtime.mode.kind === 'playground'
      ? runtime.worktrees.find((worktree) => worktree.role === 'main')?.path
      : undefined;
  const measure = async (path: string, label: string, workingTree: boolean) => {
    setBusy(label);
    try {
      const shape = await labApi<RepoShape>('/repos/measure', {
        method: 'POST',
        body: JSON.stringify({ path, workingTree }),
      });
      setShapes((current) => ({ ...current, [label]: shape }));
    } finally {
      setBusy(undefined);
    }
  };
  const columns = Object.entries(shapes);
  const max = (key: keyof RepoShape) =>
    Math.max(
      ...columns.map(([, shape]) => {
        const value = shape[key];
        return Array.isArray(value)
          ? Math.max(0, ...value)
          : Number(value ?? 0);
      }),
    );
  return (
    <Section
      title="Is the playground shaped like real work?"
      description="Measured live, numbers only: no file names or contents leave the repositories. The dev playground used to be 34 files; the bugs lived in the gap."
      actions={
        playground &&
        runtime.status === 'ready' &&
        runtime.mode.kind === 'playground' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== undefined}
            onClick={() =>
              void measure(
                playground,
                `playground:${runtime.mode.kind === 'playground' ? runtime.mode.profile : ''}`,
                true,
              )
            }
          >
            <Ruler /> Measure the running playground
          </Button>
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        {repositories.data?.repositories.map((repo) => (
          <Button
            key={repo.path}
            size="xs"
            variant="outline"
            disabled={busy !== undefined}
            onClick={() => void measure(repo.path, alias(repo.path), false)}
            title="Counting files on disk can take a minute on big repos; this skips it"
          >
            <Ruler /> {alias(repo.path)}
          </Button>
        ))}
        {busy && (
          <span className="text-xs text-muted-foreground">
            Measuring {busy}…
          </span>
        )}
      </div>
      {columns.length === 0 ? (
        <Empty>
          Measure the running playground and a real repository to compare them.
        </Empty>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">Metric</th>
                {columns.map(([label, shape]) => (
                  <th key={label} className="px-3 py-2 text-right font-normal">
                    {label}
                    <div className="text-[10px]">
                      {ms(shape.measuredMs)} to measure
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {shapeRows.map(([key, label]) => {
                const top = max(key);
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {label}
                    </td>
                    {columns.map(([name, shape]) => {
                      const value = shape[key];
                      const number = Array.isArray(value)
                        ? Math.max(0, ...value)
                        : Number(value ?? 0);
                      const small = top > 0 && number > 0 && number * 10 < top;
                      return (
                        <td key={name} className="px-3 py-1.5 text-right">
                          <span
                            className={cn(small && 'text-[var(--lab-serious)]')}
                            title={
                              small
                                ? 'Less than a tenth of the largest column'
                                : undefined
                            }
                          >
                            {value === undefined
                              ? '—'
                              : Array.isArray(value)
                                ? value.join(' · ')
                                : count(value as number)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const metrics = [
  ['processes', 'Git processes'],
  ['wallMs', 'Time (wall)'],
  ['queueMs', 'Queue wait'],
  ['sql', 'SQL statements'],
  ['requests', 'Requests'],
] as const;
type Metric = (typeof metrics)[number][0];

function Benchmarks({ alias }: { alias: (path: string) => string }) {
  const { bench, runtime } = useLab();
  const lab = useLabStatic();
  const runs = useBenchRuns();
  const client = useQueryClient();
  const [metric, setMetric] = useState<Metric>('processes');
  const [targets, setTargets] = useState<Set<string>>(
    new Set(['fixture', 'app']),
  );
  const [includeReal, setIncludeReal] = useState(false);
  const running = Boolean(bench && !bench.done);
  const start = useMutation({
    mutationFn: (modes?: RuntimeMode[]) =>
      labApi('/bench', {
        method: 'POST',
        body: JSON.stringify({ targets: modes }),
      }),
  });
  const saveBudgets = useMutation({
    mutationFn: (budgets: Record<string, Budget>) =>
      labApi('/budgets', { method: 'PUT', body: JSON.stringify(budgets) }),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ['lab-static'] }),
  });
  const shown = useMemo(() => {
    // Latest run per target, smallest profile first so scale reads left to right.
    const order = [
      'playground:fixture',
      'playground:app',
      'playground:monorepo',
    ];
    const rank = (target: string) =>
      order.includes(target) ? order.indexOf(target) : order.length;
    const seen = new Set<string>();
    return (runs.data?.runs ?? [])
      .filter((run) => {
        if (seen.has(run.target)) return false;
        seen.add(run.target);
        return true;
      })
      .slice(0, 6)
      .sort((a, b) => rank(a.target) - rank(b.target));
  }, [runs.data]);
  const budgets = lab.data?.budgets ?? {};
  const steps = lab.data?.benchSteps ?? [];
  const label = (run: BenchRun) =>
    run.real && runtime.status !== 'stopped' && runtime.mode.kind === 'real'
      ? `real: ${runtime.mode.repositories.map(alias).join(', ')}`
      : run.target;
  return (
    <Section
      title="Benchmarks"
      description="Scripted moments that mirror what the web asks for (open, select a worktree, open diffs, files, history, mark reviewed, an agent editing while you look). Numbers come from the traces, not from timers alone."
      actions={
        <Button
          size="sm"
          disabled={running || runtime.status !== 'ready'}
          onClick={() => start.mutate(undefined)}
        >
          <Play /> Run on the current server
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
        <Gauge className="size-4 text-muted-foreground" />
        <span>Across profiles:</span>
        {Object.keys(lab.data?.profiles ?? {}).map((id) => (
          <label key={id} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={targets.has(id)}
              onChange={() =>
                setTargets((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
            {id}
          </label>
        ))}
        {runtime.status !== 'stopped' && runtime.mode.kind === 'real' && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeReal}
              onChange={() => setIncludeReal(!includeReal)}
            />
            the current real projects
          </label>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={running || targets.size === 0}
          onClick={() =>
            start.mutate([
              ...[...targets].map(
                (profile): RuntimeMode => ({ kind: 'playground', profile }),
              ),
              ...(includeReal &&
              runtime.status !== 'stopped' &&
              runtime.mode.kind === 'real'
                ? [runtime.mode]
                : []),
            ])
          }
        >
          Run the matrix
        </Button>
        <span className="text-xs text-muted-foreground">
          Restarts the server once per target.
        </span>
      </div>
      {bench && !bench.done && (
        <p className="text-sm text-muted-foreground">
          Running on {bench.run.target}: {bench.progress}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {metrics.map(([id, name]) => (
          <Button
            key={id}
            size="xs"
            variant={metric === id ? 'secondary' : 'ghost'}
            onClick={() => setMetric(id)}
          >
            {name}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty>No benchmark yet.</Empty>
      ) : (
        <BenchMatrix
          runs={shown}
          steps={steps}
          metric={metric}
          budgets={budgets}
          label={label}
          onBudget={(step, budget) =>
            saveBudgets.mutate({ ...budgets, [step]: budget })
          }
        />
      )}
    </Section>
  );
}

function BenchMatrix({
  runs,
  steps,
  metric,
  budgets,
  label,
  onBudget,
}: {
  runs: BenchRun[];
  steps: { id: string; title: string }[];
  metric: Metric;
  budgets: Record<string, Budget>;
  label: (run: BenchRun) => string;
  onBudget: (step: string, budget: Budget) => void;
}) {
  const [editing, setEditing] = useState<string>();
  const value = (run: BenchRun, step: string) =>
    run.steps.find((item) => item.step === step);
  const format = (number: number) =>
    metric === 'wallMs' || metric === 'queueMs' ? ms(number) : count(number);
  // Only Git process ceilings are recorded; time and queue wait are reported.
  const budgetOf = (step: string) =>
    metric === 'processes' ? budgets[step]?.processes : undefined;
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-normal">Moment</th>
            <th className="px-3 py-2 text-right font-normal">Budget</th>
            {runs.map((run) => (
              <th key={run.id} className="px-3 py-2 text-right font-normal">
                {label(run)}
                <div className="text-[10px]">
                  {new Date(run.at).toLocaleString()}
                </div>
                {run.error && (
                  <div className="text-[10px] text-[var(--lab-danger)]">
                    {run.error}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {steps.map((step) => {
            const budget = budgetOf(step.id);
            const row = runs.map((run) => value(run, step.id)?.[metric] ?? 0);
            const top = Math.max(1, ...row, budget ?? 0);
            return (
              <tr key={step.id} className="border-t align-top">
                <td className="px-3 py-2">{step.title}</td>
                <td className="px-3 py-2 text-right">
                  {metric !== 'processes' ? (
                    // Only Git process ceilings are recorded; the rest report.
                    <span className="text-muted-foreground">—</span>
                  ) : editing === step.id ? (
                    <form
                      className="flex justify-end gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        onBudget(step.id, {
                          processes: Number(data.get('processes')) || undefined,
                        });
                        setEditing(undefined);
                      }}
                    >
                      <Input
                        name="processes"
                        placeholder="git"
                        defaultValue={budgets[step.id]?.processes}
                        className="h-6 w-14 text-xs"
                      />
                      <Button size="xs" type="submit">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(step.id)}
                    >
                      {budget !== undefined ? format(budget) : 'set'}
                    </button>
                  )}
                </td>
                {runs.map((run) => {
                  const result = value(run, step.id);
                  if (!result)
                    return (
                      <td
                        key={run.id}
                        className="px-3 py-2 text-right text-muted-foreground"
                      >
                        —
                      </td>
                    );
                  const number = result[metric];
                  const over = budget !== undefined && number > budget;
                  return (
                    <td
                      key={run.id}
                      className="px-3 py-2 text-right"
                      title={`${result.requests} requests · ${result.processes} git · ${result.sql} sql · ${ms(result.wallMs)} wall · ${ms(result.queueMs)} queued${result.lateMs ? ` · +${ms(result.lateMs)} late` : ''}`}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {budget !== undefined && (
                          <StatusMark status={over ? 'danger' : 'ok'}>
                            <span className="sr-only">
                              {over ? 'over budget' : 'within budget'}
                            </span>
                          </StatusMark>
                        )}
                        <span className={cn(over && 'font-semibold')}>
                          {format(number)}
                        </span>
                      </div>
                      <div className="relative mt-1 ml-auto h-1 w-28 rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-[var(--lab-git)]"
                          style={{ width: `${(number / top) * 100}%` }}
                        />
                        {budget !== undefined && (
                          <div
                            className="absolute -top-0.5 h-2 w-px bg-foreground"
                            style={{ left: `${(budget / top) * 100}%` }}
                          />
                        )}
                      </div>
                      {result.errors > 0 && (
                        <div className="text-[10px] text-[var(--lab-danger)]">
                          {result.errors} failed
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
