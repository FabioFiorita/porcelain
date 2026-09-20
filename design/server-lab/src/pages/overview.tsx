import { cn } from 'cn';
import { ArrowRight } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { Section, Stat, StatusMark } from '@/components/lab/bits';
import { SourceLink } from '@/components/lab/source';
import { useHoverTip } from '@/components/lab/traces';
import { ms } from '@/lib/format';
import { type Trace, useLab } from '@/lib/lab';
import { areas, areaTests, tracesForFlow, verdictTone } from '@/lib/map';
import { href } from '@/lib/route';

const runners = ['operations', 'discovery', 'browsing', 'drafting'];

export function OverviewPage() {
  const { runtime, vitals, traces } = useLab();
  const layers = useMemo(() => {
    const unique = (values: string[]) => new Set(values).size;
    const flows = areas.flatMap((area) => area.flows);
    const steps = flows.flatMap((flow) => flow.steps);
    return [
      {
        label: 'Web hooks',
        value: unique(
          flows.flatMap((flow) =>
            flow.webTriggers.map((trigger) => trigger.hook),
          ),
        ),
        hint: 'apps/web/src/query',
      },
      {
        label: 'HTTP routes',
        value:
          runtime.status === 'ready'
            ? runtime.routes.length
            : flows.filter((flow) => flow.endpoint).length,
        hint: 'apps/server/src/http/routes',
      },
      { label: 'Application', value: 1, hint: 'apps/server/src/app.ts' },
      { label: 'Queues', value: runners.length, hint: 'OperationRunner' },
      {
        label: 'Use cases',
        value: unique(
          steps
            .filter((step) => step.layer === 'use-case')
            .map((step) => step.name.split('.')[0] ?? step.name),
        ),
        hint: 'apps/server/src/use-cases',
      },
      {
        label: 'Git adapters',
        value: unique(
          steps
            .filter((step) => step.layer === 'git')
            .map((step) => step.name.split('.')[0] ?? step.name),
        ),
        hint: 'packages/git',
      },
      {
        label: 'SQLite tables',
        value: unique(
          flows.flatMap((flow) => flow.tables.map((table) => table.name)),
        ),
        hint: 'apps/server/src/db/schema',
      },
    ];
  }, [runtime]);
  const important = useMemo(
    () =>
      areas
        .flatMap((area) =>
          area.observations.map((observation) => ({ area, observation })),
        )
        .filter(
          ({ observation }) =>
            observation.confidence === 'verified' &&
            (observation.kind === 'performance' ||
              observation.kind === 'correctness' ||
              observation.kind === 'risk'),
        )
        .slice(0, 10),
    [],
  );
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            How the Porcelain server works, observed
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The real server runs here in a traced process. Every Git process,
            every wait in an operation queue and every SQL statement is tied to
            the request that caused it, whether that request came from the real
            web app, the console, a benchmark or an agent over MCP. The map
            explains why each part is built the way it is; the scale page checks
            it against repositories shaped like real work.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            {[
              ['web', 'Click around the real web, watch the server'],
              ['scale', 'Compare the playground with real repositories'],
              ['map', 'Read an area: flows, decisions, observations'],
              ['tests', 'See what the tests really check'],
            ].map(([page, text]) => (
              <a
                key={page}
                href={href(page as string)}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:bg-muted"
              >
                {text} <ArrowRight className="size-3" />
              </a>
            ))}
          </div>
        </div>

        <Section
          title="Right now"
          description="Live from the traced server process."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Git processes running"
              value={vitals?.activeProcesses ?? '—'}
            />
            <Stat
              label="Event loop delay p99"
              value={vitals ? ms(vitals.eventLoopP99Ms) : '—'}
              hint={
                vitals
                  ? `max ${ms(vitals.eventLoopMaxMs)} in the last second`
                  : undefined
              }
            />
            <Stat
              label="Memory (RSS)"
              value={vitals ? `${vitals.rssMb} MB` : '—'}
              hint={vitals ? `heap ${vitals.heapMb} MB` : undefined}
            />
            <Stat
              label="Requests seen"
              value={
                traces.filter((trace) => trace.origin !== 'background').length
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {runners.map((runner) => {
              const queue = vitals?.queues[runner];
              return (
                <div key={runner} className="rounded-xl border px-3 py-2">
                  <div className="font-mono text-xs">{runner}</div>
                  <div className="mt-1 flex items-baseline gap-3 text-sm tabular-nums">
                    <span>
                      <b
                        className={cn(
                          'text-lg',
                          (queue?.queued ?? 0) > 0 &&
                            'text-[var(--lab-serious)]',
                        )}
                      >
                        {queue?.queued ?? 0}
                      </b>{' '}
                      <span className="text-xs text-muted-foreground">
                        waiting
                      </span>
                    </span>
                    <span>
                      <b className="text-lg">{queue?.running ?? 0}</b>{' '}
                      <span className="text-xs text-muted-foreground">
                        running
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <ProcessRate traces={traces} />
        </Section>

        <Section
          title="Layers"
          description="Every request crosses these, left to right. Counts come from the map and the live route table."
        >
          <div className="flex flex-wrap items-stretch gap-1">
            {layers.map((layer, index) => (
              <Fragment key={layer.label}>
                {index > 0 && (
                  <ArrowRight className="mx-0.5 size-4 self-center text-muted-foreground" />
                )}
                <div className="min-w-28 flex-1 rounded-xl border px-3 py-2">
                  <div className="text-lg font-semibold tabular-nums">
                    {layer.value}
                  </div>
                  <div className="text-sm">{layer.label}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {layer.hint}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </Section>

        <Section title="Areas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => {
              const tests = areaTests(area.id);
              const seen = area.flows.flatMap((flow) =>
                tracesForFlow(flow, traces),
              );
              const git = seen.reduce(
                (sum, trace) => sum + trace.processes.length,
                0,
              );
              const worrying = area.observations.filter(
                (item) =>
                  item.kind === 'performance' ||
                  item.kind === 'correctness' ||
                  item.kind === 'risk',
              ).length;
              return (
                <a
                  key={area.id}
                  href={href('map', area.id)}
                  className="flex flex-col gap-2 rounded-xl border p-3 hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{area.title}</span>
                    <span
                      className={cn(
                        'ml-auto text-xs',
                        verdictTone[tests.verdict ?? ''],
                      )}
                    >
                      {tests.verdict ? `tests ${tests.verdict}` : ''}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {area.summary}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                    <span>{area.flows.length} flows</span>
                    <span>{area.decisions.length} decisions</span>
                    {worrying > 0 && (
                      <span className="text-[var(--lab-serious)]">
                        {worrying} concerns
                      </span>
                    )}
                    {seen.length > 0 && (
                      <span>
                        {seen.length} calls · {(git / seen.length).toFixed(0)}{' '}
                        git/call
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </Section>

        {important.length > 0 && (
          <Section
            title="Verified concerns"
            description="Traced in code by the map; open one to read the evidence."
          >
            <div className="space-y-2">
              {important.map(({ area, observation }) => (
                <div
                  key={`${area.id}-${observation.title}`}
                  className="rounded-xl border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusMark status="danger">{observation.kind}</StatusMark>
                    <span className="text-sm font-medium">
                      {observation.title}
                    </span>
                    <a
                      href={href('map', area.id)}
                      className="ml-auto text-xs text-muted-foreground hover:underline"
                    >
                      {area.title}
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {observation.detail}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3">
                    {observation.sources.slice(0, 3).map((source) => (
                      <SourceLink
                        key={`${source.path}:${source.line}`}
                        source={source}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** Git processes started per second over the last two minutes. */
function ProcessRate({ traces }: { traces: Trace[] }) {
  const { bind, node } = useHoverTip();
  const now = Date.now();
  const seconds = 120;
  const buckets = useMemo(() => {
    const values = Array.from({ length: seconds }, () => 0);
    for (const trace of traces)
      for (const span of trace.processes) {
        const age = Math.floor((now - span.start) / 1000);
        if (age >= 0 && age < seconds)
          values[seconds - 1 - age] = (values[seconds - 1 - age] ?? 0) + 1;
      }
    return values;
    // Recompute when traces change; `now` is read at render.
  }, [traces, now]);
  const top = Math.max(1, ...buckets);
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Git processes started per second, last two minutes</span>
        <span className="tabular-nums">peak {top}/s</span>
      </div>
      <div className="flex h-16 items-end gap-px">
        {buckets.map((value, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: time buckets are positional
            key={index}
            {...bind(
              `${seconds - index} s ago: ${value} git process${value === 1 ? '' : 'es'}`,
            )}
            className="flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-[2px] bg-[var(--lab-git)]"
              style={{
                height: value ? `${Math.max(4, (value / top) * 100)}%` : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 h-px bg-border" />
      {node}
    </div>
  );
}
