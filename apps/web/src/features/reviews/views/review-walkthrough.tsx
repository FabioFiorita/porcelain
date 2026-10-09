import { useHotkey } from '@tanstack/react-hotkeys';
import { CheckIcon, CompassIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { desktopAppAddress } from '@/shared/adapters/desktop';
import { cn } from '@/shared/lib/utils';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { useTheme } from '@/features/preferences/index';
import {
  decisionKey,
  filesReviewed,
  neighbourStop,
  type ReviewChangeItem,
  type ReviewResponse,
  reviewSummaryUrl,
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { useSummaryLayerRequests } from '../adapters/summary-messages';
import { useWalkthrough } from '../queries/walkthrough';
import { DocumentToolbar } from './document-toolbar';
import { WalkthroughBriefing } from './walkthrough-briefing';
import type { WalkthroughProps } from './walkthrough-props';
import { WalkthroughStopView } from './walkthrough-stop';

export function ReviewWalkthrough({
  address,
  onRefresh,
  ...props
}: WalkthroughProps & { address: string; onRefresh: () => void }) {
  const { review, scope, context, interaction } = props;
  const walk = useWalkthrough(scope, context, review);
  const view = walk.view;
  const [previousSummary, setPreviousSummary] =
    useState<ReviewResponse['summary']>();
  const go = walk.go;
  const step = (direction: 1 | -1) => {
    const next = neighbourStop(walk.stops, walk.stop.key, direction);
    if (next) go(next.key);
  };
  const shortcuts = {
    ignoreInputs: true,
    enabled: interaction.active && view === 'walkthrough',
  };
  useHotkey(SHORTCUTS.nextStop, () => step(1), shortcuts);
  useHotkey(SHORTCUTS.previousStop, () => step(-1), shortcuts);
  const changedFiles = walk.stops.flatMap((stop) => stop.paths);
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Review walkthrough"
    >
      <DocumentToolbar
        title="Review"
        subtitle={`${review.layers.length} ${review.layers.length === 1 ? 'decision' : 'decisions'} · ${changedFiles.length} changed ${changedFiles.length === 1 ? 'file' : 'files'}`}
      >
        <Tabs
          value={view}
          onValueChange={(next: string) => {
            if (next === 'summary') {
              setPreviousSummary(review.summary);
              onRefresh();
              walk.setView('summary');
            } else walk.setView('walkthrough');
          }}
          aria-label="Review presentation"
        >
          <TabsList>
            <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>
            <TabsTrigger value="summary">Agent summary</TabsTrigger>
          </TabsList>
        </Tabs>
      </DocumentToolbar>
      <WalkthroughBar
        stops={walk.stops}
        items={walk.items}
        current={view === 'walkthrough' ? walk.stop.key : undefined}
        done={walk.done}
        staleDecision={(id) => walk.decisions.states.get(id)?.stale}
        onGo={go}
      />
      {walk.decisions.failed && (
        <p
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3.5 py-2 text-xs text-destructive"
        >
          Which decisions you reviewed could not be read, so none are shown as
          reviewed.
          <Button variant="outline" size="xs" onClick={walk.decisions.retry}>
            Try again
          </Button>
        </p>
      )}
      {review.diagnostics === 'unavailable' && (
        <p role="status" className="border-b px-3.5 py-2 text-xs">
          The worktree is unavailable. This is the saved review; code locations
          and coverage could not be checked.
        </p>
      )}
      {view === 'summary' ? (
        review.summary === previousSummary ? (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Refreshing summary…
          </p>
        ) : (
          <SummaryFrame
            review={review}
            address={address}
            onLayer={(layerId) => go(decisionKey(layerId))}
          />
        )
      ) : walk.stop.kind === 'briefing' ? (
        <WalkthroughBriefing
          {...props}
          stops={walk.stops}
          items={walk.items}
          decisions={walk.decisions.states}
          done={walk.done}
          onGo={go}
        />
      ) : (
        <WalkthroughStopView
          key={walk.stop.key}
          {...props}
          stop={walk.stop}
          stops={walk.stops}
          items={walk.items}
          decision={
            walk.stop.kind === 'decision'
              ? walk.decisions.states.get(walk.stop.layer.id)
              : undefined
          }
          decisionsSettled={walk.decisions.settled}
          finished={walk.done(walk.stop)}
          onGo={go}
        />
      )}
    </section>
  );
}

function WalkthroughBar({
  stops,
  items,
  current,
  done: isDone,
  staleDecision,
  onGo,
}: {
  stops: readonly WalkthroughStop[];
  items: readonly ReviewChangeItem[];
  current: WalkthroughKey | undefined;
  done: (stop: WalkthroughStop) => boolean;
  staleDecision: (layerId: string) => boolean | undefined;
  onGo: (key: WalkthroughKey) => void;
}) {
  const total = filesReviewed(
    stops.flatMap((stop) => stop.paths),
    items,
  );
  const decisions = stops.filter((stop) => stop.kind === 'decision');
  const done = decisions.filter(isDone);
  return (
    <nav
      aria-label="Walkthrough progress"
      className="flex shrink-0 items-center gap-3 border-b px-3.5 py-1.5"
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {stops.map((stop) => {
          const progress = filesReviewed(stop.paths, items);
          const reviewed = isDone(stop);
          const stale =
            stop.kind === 'decision' && staleDecision(stop.layer.id) === true;
          const label =
            stop.kind === 'briefing'
              ? 'Open the briefing'
              : `${stopTitle(stop)} · ${progress.reviewed} of ${progress.total} files reviewed${stale ? ' · code moved' : ''}${reviewed ? ' · done' : ''}`;
          const active = stop.key === current;
          if (stop.kind === 'briefing')
            return (
              <li key={stop.key} className="shrink-0">
                <button
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => onGo(stop.key)}
                  className={cn(
                    'grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                    active && 'bg-accent text-foreground',
                  )}
                >
                  <CompassIcon className="size-3.5" />
                </button>
              </li>
            );
          return (
            <li
              key={stop.key}
              className="min-w-3"
              style={{ flexGrow: Math.max(1, stop.paths.length) }}
            >
              <button
                type="button"
                aria-label={label}
                title={label}
                aria-current={active ? 'step' : undefined}
                onClick={() => onGo(stop.key)}
                className="group flex h-6 w-full items-center"
              >
                <span
                  className={cn(
                    'relative block h-1.5 w-full overflow-hidden rounded-full bg-muted transition-[height] group-hover:h-2.5',
                    stale && 'bg-graph-4/25',
                    stop.kind === 'unexplained' && 'bg-graph-4/20',
                    active && 'h-2.5 bg-foreground/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full bg-graph-2/70',
                      reviewed && 'bg-graph-2',
                    )}
                    style={{
                      width: `${progress.total === 0 ? (reviewed ? 100 : 0) : (progress.reviewed / progress.total) * 100}%`,
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p
        role="status"
        className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums"
      >
        {total.done && total.total > 0 && (
          <CheckIcon className="size-3.5 text-graph-2" aria-hidden="true" />
        )}
        <span>
          {total.reviewed} of {total.total} files reviewed
        </span>
        <span className="text-muted-foreground max-narrow:hidden">
          · {done.length} of {decisions.length} decisions
        </span>
      </p>
    </nav>
  );
}

function SummaryFrame({
  review,
  address,
  onLayer,
}: {
  review: ReviewResponse;
  address: string;
  onLayer: (layerId: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { dark } = useTheme();
  useSummaryLayerRequests(frame, (layerNumber) => {
    const layer = review.layers[layerNumber - 1];
    if (layer) onLayer(layer.id);
  });
  return (
    <iframe
      ref={frame}
      title="Review summary"
      src={`${reviewSummaryUrl(review.summary, address, desktopAppAddress())}#theme=${dark ? 'dark' : 'light'}`}
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      referrerPolicy="no-referrer"
      className="block min-h-0 w-full flex-1 border-0"
      style={{ colorScheme: dark ? 'dark' : 'light' }}
    />
  );
}
