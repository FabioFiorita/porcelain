import { cn } from 'cn';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  bytes,
  count,
  duration,
  gitCommand,
  gitSignature,
  type Interaction,
  ms,
  processTime,
  queueWait,
  routeLabel,
  shortRoute,
  totals,
} from '@/lib/format';
import type { Trace } from '@/lib/lab';
import { flowForTrace } from '@/lib/map';
import { href } from '@/lib/route';
import { Method, OriginDot, Stat } from './bits';

/** A tooltip that follows the pointer; hit targets are the whole row. */
export function useHoverTip() {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  }>();
  const bind = (content: ReactNode) => ({
    onMouseMove: (event: React.MouseEvent) =>
      setTip({ x: event.clientX, y: event.clientY, content }),
    onMouseLeave: () => setTip(undefined),
  });
  const node = tip ? (
    <div
      className="pointer-events-none fixed z-50 max-w-sm rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg"
      style={{
        left: Math.min(tip.x + 14, window.innerWidth - 340),
        top: tip.y + 14,
      }}
    >
      {tip.content}
    </div>
  ) : null;
  return { bind, node };
}

export function InteractionRow({
  interaction,
  selected,
  onSelect,
}: {
  interaction: Interaction;
  selected: boolean;
  onSelect: () => void;
}) {
  const sum = totals(interaction.traces);
  const span = interaction.end - interaction.start;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left hover:bg-muted',
        selected && 'bg-muted ring-1 ring-border',
      )}
    >
      <div className="flex w-full items-center gap-2">
        <OriginDot origin={interaction.origin} label={false} />
        <span className="min-w-0 flex-1 truncate text-sm">
          {interaction.traces.length > 1 && interaction.origin !== 'bench'
            ? `${interaction.traces.length} requests`
            : interaction.label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {new Date(interaction.start).toLocaleTimeString()}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-4 text-xs tabular-nums text-muted-foreground">
        <span>{ms(span)}</span>
        <span>
          <b className="font-medium text-foreground">{count(sum.processes)}</b>{' '}
          git
        </span>
        <span>{count(sum.sql)} sql</span>
        {sum.queue > 5 && <span>{ms(sum.queue)} queued</span>}
        {sum.late > 0 && (
          <span className="text-[var(--lab-serious)]">
            +{ms(sum.late)} late
          </span>
        )}
        {sum.errors > 0 && (
          <span className="text-[var(--lab-danger)]">{sum.errors} failed</span>
        )}
      </div>
    </button>
  );
}

/** Requests of one interaction on a shared time axis. */
export function Waterfall({
  traces,
  selected,
  onSelect,
}: {
  traces: Trace[];
  selected?: string;
  onSelect: (trace: Trace) => void;
}) {
  const { bind, node } = useHoverTip();
  if (traces.length === 0) return null;
  const start = Math.min(...traces.map((trace) => trace.start));
  const end = Math.max(
    ...traces.map((trace) => (trace.end ?? trace.start) + (trace.lateMs ?? 0)),
    start + 1,
  );
  const total = end - start;
  const x = (time: number) => `${((time - start) / total) * 100}%`;
  const w = (from: number, to: number) =>
    `${Math.max(0.4, ((to - from) / total) * 100)}%`;
  return (
    <div className="space-y-px">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-2 pb-1 text-[11px] text-muted-foreground">
        <span>Request</span>
        <span className="flex justify-between tabular-nums">
          <span>0</span>
          <span>{ms(total)}</span>
        </span>
      </div>
      {traces.map((trace) => {
        const traceEnd = trace.end ?? trace.start;
        const queued = trace.operations
          .filter((span) => span.started !== undefined)
          .map((span) => [span.queued, span.started as number] as const);
        return (
          <button
            key={trace.id}
            type="button"
            onClick={() => onSelect(trace)}
            {...bind(<TraceTip trace={trace} />)}
            className={cn(
              'grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted',
              selected === trace.id && 'bg-muted ring-1 ring-border',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs">
              <Method method={trace.method} />
              <span
                className="min-w-0 truncate font-mono text-[11px]"
                title={routeLabel(trace)}
              >
                {shortRoute(trace)}
              </span>
              {trace.processes.length > 0 && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {trace.processes.length}
                </span>
              )}
            </span>
            <span className="relative h-4">
              <span
                className="absolute top-1.5 h-1 rounded-full bg-[var(--lab-run)]"
                style={{
                  left: x(trace.start),
                  width: w(trace.start, traceEnd),
                }}
              />
              {queued.map(([from, to]) => (
                <span
                  key={`${from}-${to}`}
                  className="lab-hatch absolute top-0.5 h-3 rounded-sm"
                  style={{ left: x(from), width: w(from, to) }}
                />
              ))}
              {trace.lateMs ? (
                <span
                  className="absolute top-1.5 h-1 border-t border-dashed border-[var(--lab-serious)]"
                  style={{
                    left: x(traceEnd),
                    width: w(traceEnd, traceEnd + trace.lateMs),
                  }}
                />
              ) : null}
              {trace.processes.map((span, index) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: spans are positional
                  key={index}
                  className="absolute top-2.5 h-1.5 rounded-[1px] bg-[var(--lab-git)]"
                  style={{
                    left: x(span.start),
                    width: w(span.start, span.end ?? span.start),
                  }}
                />
              ))}
              {(trace.status ?? 0) >= 400 || trace.aborted ? (
                <TriangleAlert
                  className="absolute -top-0.5 size-3.5 text-[var(--lab-danger)]"
                  style={{ left: `calc(${x(traceEnd)} + 4px)` }}
                />
              ) : null}
            </span>
          </button>
        );
      })}
      <Legend />
      {node}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-[var(--lab-run)]" /> request
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="lab-hatch h-3 w-4 rounded-sm" /> waiting in a queue
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-4 rounded-[1px] bg-[var(--lab-git)]" /> git
        process
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 border-t border-dashed border-[var(--lab-serious)]" />{' '}
        work after the response
      </span>
    </div>
  );
}

function TraceTip({ trace }: { trace: Trace }) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono">
        {trace.method}{' '}
        {trace.url.length > 80 ? `${trace.url.slice(0, 80)}…` : trace.url}
      </div>
      <div className="tabular-nums text-muted-foreground">
        {trace.status ?? '…'} · {ms(duration(trace))} · {trace.processes.length}{' '}
        git · {trace.sqlCount} sql
        {queueWait(trace) > 1 ? ` · ${ms(queueWait(trace))} queued` : ''}
        {trace.lateMs ? ` · +${ms(trace.lateMs)} after response` : ''}
      </div>
    </div>
  );
}

export function TraceDetail({ trace }: { trace: Trace }) {
  const [tab, setTab] = useState<'timeline' | 'git' | 'sql'>('timeline');
  const flow = flowForTrace(trace);
  const git = useMemo(() => {
    const groups = new Map<
      string,
      { calls: number; ms: number; bytes: number }
    >();
    for (const span of trace.processes) {
      const key = gitSignature(span.args);
      const group = groups.get(key) ?? { calls: 0, ms: 0, bytes: 0 };
      group.calls++;
      group.ms += (span.end ?? span.start) - span.start;
      group.bytes += span.stdoutBytes ?? 0;
      groups.set(key, group);
    }
    return [...groups.entries()].sort(
      (a, b) => b[1].calls - a[1].calls || b[1].ms - a[1].ms,
    );
  }, [trace]);
  const sql = useMemo(() => {
    const groups = new Map<string, number>();
    for (const statement of trace.sql)
      groups.set(
        `${statement.kind} ${statement.table}`,
        (groups.get(`${statement.kind} ${statement.table}`) ?? 0) + 1,
      );
    return [...groups.entries()].sort((a, b) => b[1] - a[1]);
  }, [trace]);
  const total = duration(trace);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Method method={trace.method} className="w-auto" />
          <span className="min-w-0 break-all font-mono text-sm">
            {trace.url}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <OriginDot origin={trace.origin} />
          {trace.step && <Badge variant="outline">{trace.step}</Badge>}
          {trace.route && <span className="font-mono">{trace.route}</span>}
          {trace.blocked && (
            <Badge variant="destructive">read-only: {trace.blocked}</Badge>
          )}
          {trace.aborted && (
            <Badge variant="destructive">client went away</Badge>
          )}
          {flow && (
            <a
              href={href('map', flow.area.id, flow.flow.id)}
              className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
            >
              {flow.area.title} → {flow.flow.title}{' '}
              <ArrowRight className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Status"
          value={trace.status ?? '…'}
          tone={(trace.status ?? 0) >= 400 ? 'danger' : undefined}
        />
        <Stat label="Total" value={ms(total)} />
        <Stat
          label="Git"
          value={count(trace.processes.length)}
          hint={`${ms(processTime(trace))} summed`}
        />
        <Stat
          label="Queued"
          value={ms(queueWait(trace))}
          hint={
            trace.operations.map((span) => span.runner).join(', ') || 'no queue'
          }
        />
        <Stat label="SQL" value={count(trace.sqlCount)} />
        <Stat
          label="Response"
          value={bytes(trace.responseBytes)}
          hint={
            trace.lateMs
              ? `+${ms(trace.lateMs)} work after response`
              : undefined
          }
        />
      </div>
      <div className="flex gap-1 border-b">
        {(
          [
            ['timeline', 'Timeline'],
            ['git', `Git (${trace.processes.length})`],
            ['sql', `SQL (${trace.sqlCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground',
              tab === id && 'border-foreground text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'timeline' && <SpanTimeline trace={trace} />}
      {tab === 'git' && (
        <div className="space-y-4">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Command (grouped)</th>
                <th className="w-16 py-1 text-right font-normal">Calls</th>
                <th className="w-20 py-1 text-right font-normal">Time</th>
                <th className="w-20 py-1 text-right font-normal">Output</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {git.map(([signature, group]) => (
                <tr key={signature} className="border-t">
                  <td className="py-1 font-mono text-[11px]">
                    git {signature}
                  </td>
                  <td
                    className={cn(
                      'py-1 text-right',
                      group.calls > 1 && 'font-semibold',
                    )}
                  >
                    {group.calls}
                  </td>
                  <td className="py-1 text-right">{ms(group.ms)}</td>
                  <td className="py-1 text-right">
                    {group.bytes ? bytes(group.bytes) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Every process in order
            </summary>
            <ol className="mt-2 space-y-1 font-mono text-[11px]">
              {trace.processes.map((span, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: processes are positional
                <li key={index} className="flex gap-2">
                  <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                    {ms((span.end ?? span.start) - span.start)}
                  </span>
                  <span className="break-all">
                    {span.file} {gitCommand(span.args)}
                    {span.exitCode ? (
                      <span className="text-[var(--lab-danger)]">
                        {' '}
                        → exit {span.exitCode}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {tab === 'sql' && (
        <div className="space-y-4">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Statement kind · table</th>
                <th className="w-16 py-1 text-right font-normal">Count</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sql.map(([key, value]) => (
                <tr key={key} className="border-t">
                  <td className="py-1 font-mono text-[11px]">{key}</td>
                  <td className="py-1 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trace.sqlCount > trace.sql.length && (
            <p className="text-xs text-muted-foreground">
              Showing the first {trace.sql.length} of {trace.sqlCount}{' '}
              statements.
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Statements in order
            </summary>
            <ol className="mt-2 space-y-1 font-mono text-[11px]">
              {trace.sql.map((statement, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: statements are positional
                <li key={index} className="break-all">
                  {statement.sql}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}

/** Every span of one request: queue waits, operations, processes, SQL ticks. */
function SpanTimeline({ trace }: { trace: Trace }) {
  const { bind, node } = useHoverTip();
  const start = trace.start;
  const end = Math.max(
    (trace.end ?? start) + (trace.lateMs ?? 0),
    ...trace.processes.map((span) => span.end ?? span.start),
    ...trace.operations.map((span) => span.settled ?? span.queued),
    start + 1,
  );
  const total = end - start;
  const x = (time: number) => `${((time - start) / total) * 100}%`;
  const w = (from: number, to: number) =>
    `${Math.max(0.3, ((to - from) / total) * 100)}%`;
  const rows: {
    key: string;
    label: ReactNode;
    bar: ReactNode;
    tip: ReactNode;
  }[] = [
    {
      key: 'request',
      label: trace.origin === 'background' ? 'Background work' : 'HTTP request',
      bar: (
        <>
          <span
            className="absolute top-1.5 h-1.5 rounded-full bg-[var(--lab-run)]"
            style={{ left: 0, width: w(start, trace.end ?? start) }}
          />
          {trace.lateMs ? (
            <span
              className="absolute top-2 h-0 border-t border-dashed border-[var(--lab-serious)]"
              style={{ left: x(trace.end ?? start), width: w(0, trace.lateMs) }}
            />
          ) : null}
        </>
      ),
      tip: `${ms(duration(trace))} until the response${trace.lateMs ? `, then ${ms(trace.lateMs)} more work` : ''}`,
    },
    ...trace.operations.map((span) => ({
      key: `operation-${span.operation}`,
      label: <span className="font-mono">{span.runner} queue</span>,
      bar: (
        <>
          <span
            className="lab-hatch absolute top-0.5 h-3.5 rounded-sm"
            style={{
              left: x(span.queued),
              width: w(
                span.queued,
                span.started ?? span.settled ?? span.queued,
              ),
            }}
          />
          {span.started !== undefined && (
            <span
              className="absolute top-1 h-2.5 rounded-sm bg-[var(--lab-run)]"
              style={{
                left: x(span.started),
                width: w(span.started, span.settled ?? span.started),
              }}
            />
          )}
        </>
      ),
      tip: `Waited ${ms((span.started ?? span.settled ?? span.queued) - span.queued)} in "${span.runner}", ran ${
        span.started !== undefined && span.settled !== undefined
          ? ms(span.settled - span.started)
          : '—'
      }${span.failed ? ' (failed)' : ''}`,
    })),
    ...trace.processes.map((span, index) => ({
      key: `process-${index}`,
      label: (
        <span className="truncate font-mono">
          git {gitSignature(span.args)}
        </span>
      ),
      bar: (
        <span
          className="absolute top-1 h-2.5 rounded-[2px] bg-[var(--lab-git)]"
          style={{
            left: x(span.start),
            width: w(span.start, span.end ?? span.start),
          }}
        />
      ),
      tip: (
        <span className="font-mono break-all">
          {ms((span.end ?? span.start) - span.start)} · git{' '}
          {gitCommand(span.args).slice(0, 300)}
        </span>
      ),
    })),
  ];
  if (trace.sql.length)
    rows.push({
      key: 'sql',
      label: `SQL (${trace.sqlCount})`,
      bar: (
        <>
          {trace.sql.map((statement, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: statements are positional
              key={index}
              className="absolute top-0.5 h-3.5 w-0.5 bg-[var(--lab-sql)]"
              style={{ left: x(statement.at) }}
            />
          ))}
        </>
      ),
      tip: `${trace.sqlCount} statements (SQLite is synchronous: each tick blocks the event loop briefly)`,
    });
  return (
    <div className="space-y-px">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-3 px-1 pb-1 text-[11px] text-muted-foreground">
        <span />
        <span className="flex justify-between tabular-nums">
          <span>0</span>
          <span>{ms(total)}</span>
        </span>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {rows.map((row) => (
          <div
            key={row.key}
            {...bind(row.tip)}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-3 rounded px-1 py-0.5 text-[11px] hover:bg-muted"
          >
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="relative h-[18px]">{row.bar}</span>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}
