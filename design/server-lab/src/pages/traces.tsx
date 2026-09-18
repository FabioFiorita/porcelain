import { cn } from 'cn';
import { Pause, Play, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Empty, OriginDot } from '@/components/lab/bits';
import {
  InteractionRow,
  TraceDetail,
  Waterfall,
} from '@/components/lab/traces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  groupInteractions,
  type Interaction,
  origins,
  routeLabel,
} from '@/lib/format';
import { labApi, type Trace, useLab } from '@/lib/lab';
import { navigate } from '@/lib/route';

export function TracesPage({ selected }: { selected?: string }) {
  const { traces } = useLab();
  const [hidden, setHidden] = useState<Set<string>>(new Set(['setup']));
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState<Trace[] | undefined>();
  const source = paused ?? traces;
  const visible = useMemo(
    () =>
      source.filter(
        (trace) =>
          !hidden.has(trace.origin) &&
          (!filter ||
            `${trace.method} ${routeLabel(trace)} ${trace.url}`.includes(
              filter,
            )),
      ),
    [source, hidden, filter],
  );
  const interactions = useMemo(
    () => groupInteractions(visible).reverse(),
    [visible],
  );
  const selectedTrace = traces.find((trace) => trace.id === selected);
  const [openInteraction, setOpenInteraction] = useState<string>();
  const interaction =
    interactions.find((group) => group.id === openInteraction) ??
    (selectedTrace
      ? interactions.find((group) =>
          group.traces.some((trace) => trace.id === selectedTrace.id),
        )
      : interactions[0]);
  return (
    <TraceWorkspace
      interactions={interactions}
      interaction={interaction}
      selectedTrace={selectedTrace}
      onInteraction={(group) => {
        setOpenInteraction(group.id);
        navigate('traces', group.traces[0]?.id);
      }}
      onTrace={(trace) => navigate('traces', trace.id)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {origins.map((origin) => (
            <button
              key={origin}
              type="button"
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current);
                  if (next.has(origin)) next.delete(origin);
                  else next.add(origin);
                  return next;
                })
              }
              className={cn(
                'rounded-full border px-2 py-0.5',
                hidden.has(origin) && 'opacity-40',
              )}
            >
              <OriginDot origin={origin} />
            </button>
          ))}
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by route…"
            className="h-7 w-48"
          />
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPaused(paused ? undefined : traces)}
          >
            {paused ? <Play /> : <Pause />} {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void labApi('/traces', { method: 'DELETE' })}
          >
            <Trash2 /> Clear
          </Button>
        </div>
      }
    />
  );
}

export function TraceWorkspace({
  interactions,
  interaction,
  selectedTrace,
  onInteraction,
  onTrace,
  toolbar,
  compact,
}: {
  interactions: Interaction[];
  interaction?: Interaction;
  selectedTrace?: Trace;
  onInteraction: (interaction: Interaction) => void;
  onTrace: (trace: Trace) => void;
  toolbar?: React.ReactNode;
  compact?: boolean;
}) {
  const trace = selectedTrace ?? interaction?.traces[0];
  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      <div
        className={cn(
          'grid min-h-0 flex-1',
          compact
            ? 'grid-rows-[minmax(0,0.5fr)_minmax(0,1.5fr)]'
            : 'grid-cols-[300px_minmax(0,1fr)_minmax(0,1.2fr)]',
        )}
      >
        <div
          className={cn(
            'min-h-0 overflow-auto p-2',
            compact ? 'border-b' : 'border-r',
          )}
        >
          {interactions.length === 0 ? (
            <Empty>
              No requests yet. Use the web, the console, or run a benchmark.
            </Empty>
          ) : (
            interactions
              .slice(0, 400)
              .map((group) => (
                <InteractionRow
                  key={group.id}
                  interaction={group}
                  selected={group.id === interaction?.id}
                  onSelect={() => onInteraction(group)}
                />
              ))
          )}
        </div>
        {!compact && (
          <div className="min-h-0 overflow-auto border-r p-3">
            {interaction ? (
              <Waterfall
                traces={interaction.traces}
                selected={trace?.id}
                onSelect={onTrace}
              />
            ) : null}
          </div>
        )}
        <div className="min-h-0 overflow-auto p-4">
          {compact && interaction && (
            <div className="mb-4">
              <Waterfall
                traces={interaction.traces}
                selected={trace?.id}
                onSelect={onTrace}
              />
            </div>
          )}
          {trace ? <TraceDetail trace={trace} /> : null}
        </div>
      </div>
    </div>
  );
}
