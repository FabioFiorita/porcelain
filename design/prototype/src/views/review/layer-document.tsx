import {
  ArrowRight,
  Braces,
  ChevronRight,
  GitCommitHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { GitChange, TextRangeRequest } from '../../contracts/git-status';
import type { ReviewLayer, ReviewStep } from '../../contracts/review';
import {
  anchorPlacement,
  type CommentThread,
  onRevision,
  threadPath,
} from '../../domain/comments';
import {
  basename,
  changePath,
  diffSelection,
  layerCommitted,
  layerState,
  listChanges,
  type ReviewScope,
  stepLane,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import { useMarks } from '../../query/marks';
import {
  useChanges,
  useDiffs,
  useReview,
  useTextRanges,
} from '../../query/review';
import { contextDiff, focusedDiff } from './diff-entries';
import { MissingDocument, TickButton } from './document-parts';
import { MarkdownView } from './markdown-view';
import type { DocumentProps } from './overview-document';
import { patchLines } from './patch-focus';
import { useMarkActions } from './review-actions';
import { ReviewBoundary, ReviewPending } from './review-boundary';
import { type Graph, type GraphBox, ReviewDiagram } from './review-diagram';
import type { OpenDocument } from './review-workspace';
import { BlockTitle, type OpenComposer, StepBlock } from './step-block';

type Lines = { startLine: number; endLine: number };
type Focus = { stepId: string; nonce: number };

/**
 * One layer of the review: a behaviour told from start to end, step by step, each
 * step with the code behind it (Code), or drawn as boxes in its lanes (Graph).
 * The layer is what the reviewer ticks; the tick stores the layer's fingerprint.
 */
export function LayerDocument({
  scope,
  layerId,
  onOpen,
}: DocumentProps & { layerId: string }) {
  const review = useReview(scope);
  const marks = useMarks(scope);
  const actions = useMarkActions(scope, marks);
  const [view, setView] = useState<'code' | 'graph'>('code');
  const [focus, setFocus] = useState<Focus | null>(null);
  const index = review?.layers.findIndex((entry) => entry.id === layerId) ?? -1;
  const layer = review?.layers[index];

  if (layer == null) {
    return (
      <MissingDocument
        title="This layer is gone"
        body={
          review == null
            ? 'There is no review here any more: everything it described was committed, or it was never published.'
            : 'The agent published the review again since this tab was opened.'
        }
      />
    );
  }

  const committed = layerCommitted(layer);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[12px] font-medium tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="text-[14px] leading-snug font-semibold">
              {layer.title}
            </h1>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {layer.summary}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
              {layer.lanes.map((lane, position) => (
                <span key={lane} className="flex items-center gap-1">
                  {position > 0 && (
                    <ArrowRight aria-hidden className="size-3 opacity-60" />
                  )}
                  {lane}
                </span>
              ))}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Tabs
              value={view}
              onValueChange={(value) => {
                setView(value as typeof view);
                setFocus(null);
              }}
            >
              <TabsList className="h-7">
                <TabsTrigger value="code" className="px-2 text-xs">
                  Code
                </TabsTrigger>
                <TabsTrigger value="graph" className="px-2 text-xs">
                  Graph
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {committed ? (
              <Badge
                variant="secondary"
                className="h-7 gap-1 px-2 font-normal text-muted-foreground"
              >
                <GitCommitHorizontal className="size-3.5" />
                Committed
              </Badge>
            ) : (
              <TickButton
                state={layerState(marks, layer)}
                noun="layer"
                disabled={actions.isPending}
                onClick={() => actions.toggleLayer(layer)}
              />
            )}
          </div>
        </div>
      </header>
      {view === 'code' ? (
        <ReviewBoundary fallback={<ReviewPending rows={10} />}>
          <LayerCode
            key={layer.id}
            scope={scope}
            layer={layer}
            focus={focus}
            onOpen={onOpen}
          />
        </ReviewBoundary>
      ) : (
        <LayerGraph
          layer={layer}
          onStep={(stepId) => {
            setView('code');
            setFocus({ stepId, nonce: Date.now() });
          }}
        />
      )}
    </div>
  );
}

/** How a step shows: a focused diff, plain numbered code, a fold, or a warning. */
type StepPlan =
  | { step: ReviewStep; show: 'diff'; change: GitChange; lines: Lines }
  | { step: ReviewStep; show: 'plain'; lines: Lines }
  | { step: ReviewStep; show: 'committed'; lines: Lines }
  | { step: ReviewStep; show: 'changed' };

type Block = {
  stepId: string;
  path: string;
  lines: Lines;
  fileDiff: NonNullable<ReturnType<typeof focusedDiff>>['fileDiff'];
  plain: boolean;
  shown: ReturnType<typeof patchLines>;
};

function planSteps(
  layer: ReviewLayer,
  changes: ReadonlyMap<string, GitChange>,
): StepPlan[] {
  return layer.steps.map((step): StepPlan => {
    const location = step.location;
    if (location.state === 'changed') return { step, show: 'changed' };
    const lines = { startLine: location.startLine, endLine: location.endLine };
    if (location.state === 'committed')
      return { step, show: 'committed', lines };
    const change = changes.get(step.pointer.path);
    if (
      step.kind === 'changed' &&
      change != null &&
      diffSelection(change) != null
    )
      return { step, show: 'diff', change, lines };
    return { step, show: 'plain', lines };
  });
}

/** Each thread renders once, under the first block that shows its lines (a file thread: the file's first block). */
function assignThreads(
  blocks: readonly Block[],
  threads: readonly CommentThread[],
): Map<string, CommentThread[]> {
  const assigned = new Map<string, CommentThread[]>();
  for (const thread of threads) {
    if (!onRevision(thread.anchor, undefined)) continue;
    const path = threadPath(thread);
    const place = anchorPlacement(thread);
    if (path == null || place == null) continue;
    const block = blocks.find(
      (candidate) =>
        candidate.path === path &&
        (place.lineNumber === 0 ||
          (place.side === 'deletions'
            ? candidate.shown.deletions
            : candidate.shown.additions
          ).has(place.lineNumber)),
    );
    if (block == null) continue;
    assigned.set(block.stepId, [...(assigned.get(block.stepId) ?? []), thread]);
  }
  return assigned;
}

function LayerCode({
  scope,
  layer,
  focus,
  onOpen,
}: {
  scope: ReviewScope;
  layer: ReviewLayer;
  focus: Focus | null;
  onOpen: OpenDocument;
}) {
  const { changes } = useChanges(scope);
  const threads = useComments(scope);
  const [composer, setComposer] = useState<OpenComposer | null>(null);
  // Opened from the graph (the code view mounts then): that step starts unfolded and flashes.
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(focus == null ? [] : [focus.stepId]),
  );
  const [flash, setFlash] = useState<string | null>(focus?.stepId ?? null);
  const list = useRef<HTMLOListElement>(null);

  const byPath = useMemo(
    () =>
      new Map(
        listChanges(changes).map((listed) => [listed.path, listed.change]),
      ),
    [changes],
  );
  const plan = useMemo(() => planSteps(layer, byPath), [layer, byPath]);
  const diffChanges = useMemo(
    () => [
      ...new Map(
        plan.flatMap((item) =>
          item.show === 'diff'
            ? [[changePath(item.change), item.change] as const]
            : [],
        ),
      ).values(),
    ],
    [plan],
  );
  const rangeInputs = useMemo(
    () =>
      plan.flatMap((item): TextRangeRequest[] =>
        item.show === 'plain'
          ? [{ path: item.step.pointer.path, at: 'disk', ...item.lines }]
          : [],
      ),
    [plan],
  );
  const diffs = useDiffs(scope, diffChanges);
  const ranges = useTextRanges(scope, rangeInputs);

  const blocks = plan.flatMap((item): Block[] => {
    const path = item.step.pointer.path;
    if (item.show === 'diff') {
      const response = diffs[diffChanges.indexOf(item.change)];
      const focused =
        response == null ? null : focusedDiff(path, response, [item.lines]);
      return focused == null
        ? []
        : [
            {
              stepId: item.step.id,
              path,
              lines: item.lines,
              fileDiff: focused.fileDiff,
              plain: false,
              shown: patchLines(focused.patch),
            },
          ];
    }
    if (item.show === 'plain') {
      const range = ranges.find(
        (entry) =>
          entry.path === path &&
          entry.startLine === item.lines.startLine &&
          entry.lines.length > 0,
      );
      const context = range == null ? null : contextDiff(range);
      if (context == null) return [];
      // Unchanged code has no old side: only new-side lines take threads.
      return [
        {
          stepId: item.step.id,
          path,
          lines: item.lines,
          fileDiff: context.fileDiff,
          plain: true,
          shown: {
            additions: patchLines(context.patch).additions,
            deletions: new Set<number>(),
          },
        },
      ];
    }
    return [];
  });
  const threadsByStep = assignThreads(blocks, threads);

  // From the graph: scroll to the step once its blocks have laid out, then stop flashing it.
  const focusedStep = focus?.stepId;
  useEffect(() => {
    if (focusedStep == null) return;
    const scroll = setTimeout(() => {
      list.current
        ?.querySelector(`[data-step-id="${CSS.escape(focusedStep)}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 120);
    const clear = setTimeout(() => setFlash(null), 1800);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [focusedStep]);

  const openFile = (path: string, line: number) =>
    onOpen({ kind: 'file', path }, { path, lineNumber: line });
  const openDiff = (path: string, line: number) =>
    byPath.has(path)
      ? () =>
          onOpen(
            { kind: 'change', path },
            { path, lineNumber: line, side: 'additions' },
          )
      : undefined;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ol ref={list} className="mx-auto max-w-[72rem] px-5 pt-5 pb-24">
        {plan.map((item, position) => {
          const { step } = item;
          const block = blocks.find((entry) => entry.stepId === step.id);
          const lane = stepLane(layer, step);
          let body: ReactNode;
          if (item.show === 'changed') {
            body = (
              <>
                <StepHeading lane={lane} step={step} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-2 text-[12.5px]">
                  <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-900 dark:text-amber-100">
                    Code changed since the review was written.
                  </span>
                  <span className="min-w-0 flex-1 basis-40">
                    <BlockTitle path={step.pointer.path} lines={step.pointer} />
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    onClick={() =>
                      openFile(step.pointer.path, step.pointer.startLine)
                    }
                  >
                    Open file
                  </Button>
                </div>
              </>
            );
          } else if (item.show === 'committed') {
            const open = opened.has(step.id);
            body = (
              <>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOpened((current) => {
                      const next = new Set(current);
                      if (open) next.delete(step.id);
                      else next.add(step.id);
                      return next;
                    })
                  }
                  className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent/60"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 shrink-0 transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <GitCommitHorizontal className="size-3.5 shrink-0" />
                  <span className="shrink-0">Committed</span>
                  <span aria-hidden>·</span>
                  <span className="min-w-0 truncate font-mono text-foreground/80">
                    {step.title}
                  </span>
                  <span className="ml-auto hidden min-w-0 @[36rem]:flex">
                    <BlockTitle path={step.pointer.path} lines={item.lines} />
                  </span>
                </button>
                {open && (
                  <div className="mt-2">
                    <StepHeading lane={lane} step={step} />
                    <ReviewBoundary fallback={<ReviewPending rows={3} />}>
                      <CommittedBlock
                        scope={scope}
                        step={step}
                        lines={item.lines}
                        threads={threads}
                        composer={composer}
                        onComposer={setComposer}
                        onOpenFile={() =>
                          openFile(step.pointer.path, item.lines.startLine)
                        }
                      />
                    </ReviewBoundary>
                  </div>
                )}
              </>
            );
          } else {
            body = (
              <>
                <StepHeading lane={lane} step={step} />
                {block == null ? (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-[12px] text-muted-foreground">
                    Nothing to show for {basename(step.pointer.path)}:
                    {item.lines.startLine}–{item.lines.endLine}.
                  </p>
                ) : (
                  <StepBlock
                    scope={scope}
                    blockId={step.id}
                    path={block.path}
                    lines={block.lines}
                    fileDiff={block.fileDiff}
                    plain={block.plain}
                    threads={threadsByStep.get(step.id) ?? []}
                    composer={composer}
                    onComposer={setComposer}
                    onOpenFile={() =>
                      openFile(block.path, block.lines.startLine)
                    }
                    onOpenDiff={openDiff(block.path, block.lines.startLine)}
                  />
                )}
              </>
            );
          }
          return (
            <li
              key={step.id}
              data-step-id={step.id}
              className="@container relative scroll-mt-4 pb-7 pl-9"
            >
              {position < plan.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-7 bottom-0 left-[11px] w-px bg-border"
                />
              )}
              <span
                className={cn(
                  'absolute top-0 left-0 grid size-6 place-items-center rounded-full border bg-card text-[10.5px] text-muted-foreground tabular-nums transition-shadow',
                  flash === step.id && 'ring-2 ring-ring',
                )}
              >
                {position + 1}
              </span>
              <div
                className={cn(
                  'rounded-xl transition-shadow',
                  flash === step.id &&
                    'ring-2 ring-ring/40 ring-offset-4 ring-offset-card',
                )}
              >
                {body}
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}

function StepHeading({ lane, step }: { lane: string; step: ReviewStep }) {
  return (
    <div className="mb-2">
      {lane !== '' && (
        <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {lane}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="font-mono text-[13px] font-medium break-all">
          {step.title}
        </h2>
        {step.kind === 'context' && (
          <span className="text-[11px] text-muted-foreground">
            unchanged, for context
          </span>
        )}
      </div>
      <MarkdownView
        text={step.text}
        className="mt-0.5 max-w-[80ch] text-[13px] text-muted-foreground [&_p]:my-0.5"
      />
    </div>
  );
}

/** A committed step, unfolded: its lines as they are on disk now, no longer part of the changes. */
function CommittedBlock({
  scope,
  step,
  lines,
  threads,
  composer,
  onComposer,
  onOpenFile,
}: {
  scope: ReviewScope;
  step: ReviewStep;
  lines: Lines;
  threads: readonly CommentThread[];
  composer: OpenComposer | null;
  onComposer: (composer: OpenComposer | null) => void;
  onOpenFile: () => void;
}) {
  const inputs = useMemo<TextRangeRequest[]>(
    () => [{ path: step.pointer.path, at: 'disk', ...lines }],
    [step.pointer.path, lines],
  );
  const [range] = useTextRanges(scope, inputs);
  const context = range == null ? null : contextDiff(range);
  if (context == null) return null;
  const shown = patchLines(context.patch).additions;
  const mine = threads.filter((thread) => {
    const place = anchorPlacement(thread);
    return (
      onRevision(thread.anchor, undefined) &&
      threadPath(thread) === step.pointer.path &&
      place != null &&
      place.side === 'additions' &&
      shown.has(place.lineNumber)
    );
  });
  return (
    <StepBlock
      scope={scope}
      blockId={step.id}
      path={step.pointer.path}
      lines={lines}
      fileDiff={context.fileDiff}
      plain
      threads={mine}
      composer={composer}
      onComposer={onComposer}
      onOpenFile={onOpenFile}
    />
  );
}

/** The layer's steps as boxes in their lanes; arrows follow the step order plus the agent's extra arrows. */
function LayerGraph({
  layer,
  onStep,
}: {
  layer: ReviewLayer;
  onStep: (stepId: string) => void;
}) {
  const graph = useMemo<Graph>(() => {
    const boxes = layer.steps.map((step): GraphBox => {
      const location = step.location;
      const file = basename(step.pointer.path);
      return {
        id: step.id,
        lane: step.lane,
        label: step.title,
        kind: 'component',
        detail:
          location.state === 'committed'
            ? `Committed · ${file}`
            : location.state === 'changed'
              ? file
              : `${file}:${location.startLine}–${location.endLine}`,
        change:
          step.kind === 'changed' && location.state !== 'committed'
            ? 'changed'
            : undefined,
        dimmed: location.state === 'committed',
        warning:
          location.state === 'changed'
            ? 'Code changed since the review was written'
            : undefined,
        clickable: true,
        icon: Braces,
      };
    });
    const arrows = new Map<string, Graph['arrows'][number]>();
    layer.steps.slice(1).forEach((step, position) => {
      const from = layer.steps[position]?.id;
      if (from != null)
        arrows.set(`${from}->${step.id}`, { from, to: step.id });
    });
    for (const arrow of layer.arrows ?? [])
      arrows.set(`${arrow.from}->${arrow.to}`, arrow);
    return { lanes: layer.lanes, boxes, arrows: [...arrows.values()] };
  }, [layer]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <p className="pointer-events-none absolute top-3 left-4 z-10 max-w-[calc(100%-2rem)] rounded-md bg-card/90 px-2 py-1 text-[11.5px] text-muted-foreground">
        Each box is a step, in its lane, in the order the code runs. Click one
        to read its code.
      </p>
      <ReviewDiagram graph={graph} onBoxClick={(box) => onStep(box.id)} />
    </div>
  );
}
