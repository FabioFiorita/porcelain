import { parsePatchFiles } from '@pierre/diffs';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccessStore } from '@/features/access/index';
import {
  selectionKey,
  useChangeDiffs,
  useChangeLines,
  useChanges,
  useRecoverChangedDiffs,
} from '@/features/changes/index';
import { MarkdownView } from '@/features/files/index';
import { contentVersion } from '@/shared/lib/pierre';
import type { CodeEntry } from '../adapters/code-entries';
import { useToggleLayerMark } from '../commands/layer-marks';
import { useLayerMark } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import { contextPatch, focusPatch } from '../rules/patch-focus';
import type {
  ChangeSelection,
  ReviewChangeItem,
  ReviewLayer,
  ReviewScope,
  ReviewStep,
} from '../rules/review';
import { CodeDocument, type DocumentContext } from './code-document';
import { DocumentToolbar } from './document-toolbar';
import { type Graph, ReviewDiagram } from './review-diagram';

type LayerProps = {
  scope: ReviewScope;
  context: DocumentContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};

export function PublishedLayer({
  layer,
  ...props
}: LayerProps & { layer: ReviewLayer }) {
  const { scope, context } = props;
  const mark = useLayerMark(scope, context, layer);
  const toggle = useToggleLayerMark(scope, context);
  const { reviewed, label } = mark;
  const [view, setView] = useState('code');
  const [shown, setShown] = useState(10);
  const [focus, setFocus] = useState<string>();
  const steps = layer.steps.slice(0, shown);
  const selectedStep = layer.steps.find((step) => step.id === focus);
  const graph: Graph = {
    lanes: layer.lanes,
    boxes: layer.steps.map((step) => ({
      id: step.id,
      lane: step.lane,
      label: step.title,
      detail: step.text,
      kind: 'component',
      clickable: true,
      dimmed: step.location.state === 'committed',
      ...(step.kind === 'changed' ? { change: 'changed' as const } : {}),
      ...(step.location.state === 'changed'
        ? { warning: 'Code changed since the review was written' }
        : {}),
    })),
    arrows: [
      ...layer.steps.slice(1).flatMap((step, index) => {
        const previous = layer.steps[index];
        return previous ? [{ from: previous.id, to: step.id }] : [];
      }),
      ...(layer.arrows ?? []),
    ],
  };
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label={`Review layer ${layer.title}`}
    >
      <DocumentToolbar
        title={layer.title}
        subtitle={`${layer.steps.length} steps`}
      >
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={reviewed}
          disabled={toggle.isPending || !mark.settled}
          onClick={() =>
            toggle.toggle({
              layerId: layer.id,
              fingerprint: layer.fingerprint,
              reviewed,
            })
          }
        >
          {label}
        </Button>
        <Tabs
          value={view}
          onValueChange={setView}
          aria-label="Layer presentation"
        >
          <TabsList>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
          </TabsList>
        </Tabs>
      </DocumentToolbar>
      {(toggle.isError || mark.failed) && (
        <p role="alert" className="px-4 text-sm text-destructive">
          The layer mark could not be updated. Try again.
        </p>
      )}
      {view === 'graph' ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ReviewDiagram
            graph={graph}
            className="min-w-0"
            onBoxClick={(box) => setFocus(box.id)}
          />
          {selectedStep && (
            <section
              aria-label="Selected step code"
              className="flex min-h-0 min-w-0 flex-1 flex-col border-t md:border-t-0 md:border-l"
            >
              <div className="flex shrink-0 justify-end px-3 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFocus(undefined)}
                >
                  Close code
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <LayerSteps
                  {...props}
                  layer={layer}
                  steps={[selectedStep]}
                  focus={undefined}
                />
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <MarkdownView
            text={layer.summary}
            className="mb-5 max-w-3xl text-sm text-muted-foreground"
          />
          <LayerSteps {...props} layer={layer} steps={steps} focus={focus} />
          {shown < layer.steps.length && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShown(shown + 10)}
            >
              Show more steps
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function LayerSteps({
  layer,
  steps,
  focus,
  ...props
}: LayerProps & {
  layer: ReviewLayer;
  steps: ReviewStep[];
  focus: string | undefined;
}) {
  const { scope, context } = props;
  const connection = useAccessStore((state) => state.connection);
  const recover = useRecoverChangedDiffs(scope, connection);
  usePrefetchReviewed(scope, context);
  const { changes } = useChanges(scope, connection);
  const items = useReviewChangeItems(
    scope,
    context,
    changes,
    steps.map((step) => step.pointer.path),
  );
  const selections = items.flatMap((item) =>
    item.comparisons.flatMap((change): ChangeSelection[] =>
      change.scope !== 'staged' && change.scope !== 'unstaged'
        ? []
        : [
            {
              scope: change.scope,
              oldPath: change.oldPath,
              newPath: change.newPath,
            },
          ],
    ),
  );
  const diffs = useChangeDiffs(
    scope,
    connection,
    items[0]?.statusToken ?? '',
    items
      .filter((item) =>
        item.comparisons.some((change) => change.scope !== 'untracked'),
      )
      .map(({ path, fingerprint }) => ({ path, fingerprint })),
    selections,
    recover,
  );
  return (
    <div className="space-y-6">
      {steps.map((step) => (
        <Step
          key={step.id}
          {...props}
          step={step}
          lane={layer.lanes[step.lane] ?? ''}
          item={items.find((item) => item.path === step.pointer.path)}
          diffs={diffs}
          focus={focus === step.id}
        />
      ))}
    </div>
  );
}

function Step({
  step,
  lane,
  scope,
  context,
  interaction,
  item,
  diffs,
  focus,
  onOpen,
}: LayerProps & {
  step: ReviewStep;
  lane: string;
  item: ReviewChangeItem | undefined;
  diffs: ReturnType<typeof useChangeDiffs>;
  focus: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) element.current?.scrollIntoView({ block: 'nearest' });
  }, [focus]);
  const committed = step.location.state === 'committed';
  const changed = step.location.state === 'changed';
  const location =
    step.location.state === 'changed' ? step.pointer : step.location;
  const plain =
    step.kind === 'context' ||
    committed ||
    item?.comparisons.some((change) => change.scope === 'untracked');
  const connection = useAccessStore((state) => state.connection);
  const lines = useChangeLines(
    scope,
    connection,
    step.pointer.path,
    location.startLine,
    location.endLine,
    !changed && Boolean(plain) && (!committed || expanded),
  );
  const entries: CodeEntry[] = [];
  if (!changed && (!committed || expanded)) {
    const patches =
      plain && lines.data
        ? [
            {
              patch: contextPatch(
                step.pointer.path,
                lines.data.from,
                lines.data.lines,
              ),
              comparison: undefined,
            },
          ]
        : (item?.comparisons ?? []).flatMap((change) => {
            if (change.scope !== 'staged' && change.scope !== 'unstaged')
              return [];
            const content = diffs.diffs.get(
              selectionKey({
                scope: change.scope,
                oldPath: change.oldPath,
                newPath: change.newPath,
              }),
            );
            if (content?.kind !== 'text') return [];
            const patch = focusPatch(content.patch, [
              { startLine: location.startLine, endLine: location.endLine },
            ]);
            return patch
              ? [
                  {
                    patch,
                    comparison: {
                      kind: 'worktree' as const,
                      scope: change.scope,
                    },
                  },
                ]
              : [];
          });
    patches.forEach(({ patch, comparison }, index) => {
      const fileDiff = parsePatchFiles(patch).flatMap(
        (group) => group.files,
      )[0];
      if (fileDiff)
        entries.push({
          id: `${step.id}:${index}`,
          kind: 'diff',
          path: step.pointer.path,
          fileDiff,
          version: contentVersion(patch),
          comment: {
            filePath: step.pointer.path,
            ...(comparison ? { comparison } : {}),
            ...(item?.fingerprint
              ? { contentFingerprint: item.fingerprint }
              : {}),
          },
        });
    });
  }
  return (
    <article
      ref={element}
      className="rounded-xl bg-muted/20 p-3"
      aria-label={`Step ${step.title}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {lane}
        </span>
        <h2 className="min-w-0 flex-1 text-sm font-medium">{step.title}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpen({ kind: 'file', path: step.pointer.path })}
        >
          Open file
        </Button>
      </div>
      <MarkdownView
        text={step.text}
        className="mb-3 text-sm text-muted-foreground"
      />
      {changed ? (
        <p role="status" className="text-sm text-graph-4">
          Code changed since the review was written.
        </p>
      ) : committed && !expanded ? (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          Committed · Show code
        </Button>
      ) : entries.length > 0 ? (
        <div className="flex min-w-0 flex-col">
          <CodeDocument
            scope={scope}
            context={context}
            interaction={interaction}
            entries={entries}
            fullHeight
          />
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {lines.isError || diffs.failed
            ? 'Code could not be loaded.'
            : lines.isFetching || diffs.pending
              ? 'Loading code…'
              : 'No textual code at this location. Open the file to inspect it.'}
        </p>
      )}
    </article>
  );
}
