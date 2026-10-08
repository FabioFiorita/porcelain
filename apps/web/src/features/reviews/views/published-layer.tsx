import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { parsePatchFiles } from '@pierre/diffs';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { selectionKey } from '@porcelain/client/changes/rules';
import {
  useChangeDiffs,
  useChangeLines,
  useChanges,
} from '@/features/changes/index';
import { MarkdownView } from '@/features/files/index';
import { contentVersion } from '@/shared/lib/pierre';
import type { CodeEntry } from '../adapters/code-entries';
import { useToggleLayerMark } from '../commands/layer-marks';
import { useLayerMark } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import { contextPatch, focusPatch } from '../rules/patch-focus';
import type { ReviewProof } from '@porcelain/client/reviews/rules';
import type {
  ChangeSelection,
  ReviewChangeItem,
  ReviewLayer,
  ReviewScope,
  ReviewStep,
  ReviewResponse,
} from '@porcelain/client/reviews/rules';
import { layerDiagram } from '@porcelain/client/reviews/rules';
import { CodeDocument } from './code-document';
import { DocumentToolbar } from './document-toolbar';
import { ProofList } from './proof-list';
import type { Graph } from './review-diagram';
import { ReviewDiagram } from './lazy-review-diagram';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { spansLabel } from '../rules/patch-focus';
import { ReviewProgress } from './review-progress';

type LayerProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};

export function PublishedLayer({
  layer,
  proof,
  review,
  ...props
}: LayerProps & {
  layer: ReviewLayer;
  proof: ReviewProof;
  review: ReviewResponse;
}) {
  const { scope, context } = props;
  const mark = useLayerMark(scope, context, layer);
  const toggle = useToggleLayerMark(scope, context);
  const { reviewed, label } = mark;
  const [view, setView] = useState('code');
  const [focus, setFocus] = useState<string>();
  const selectedStep = layer.steps.find((step) => step.id === focus);
  const codeStep = selectedStep ?? layer.steps[0];
  const diagram = layerDiagram(layer);
  const graph: Graph = {
    ...diagram,
    boxes: diagram.boxes.map((box, index) => ({
      ...box,
      clickable: true,
      selected: box.id === focus,
      dimmed: layer.steps[index]?.location.state === 'committed',
      ...(layer.steps[index]?.location.state === 'changed'
        ? { warning: 'Code changed since the review was written' }
        : {}),
    })),
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
          disabled={toggle.result.waiting || !mark.settled}
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
      <ReviewProgress
        review={review}
        scope={scope}
        context={context}
        onOpen={props.onOpen}
      />
      {(AsyncResult.isFailure(toggle.result) || mark.failed) && (
        <p role="alert" className="px-4 text-sm text-destructive">
          The layer mark could not be updated. Try again.
        </p>
      )}
      {view === 'graph' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
            Agent-described relationships · select a component to inspect its
            code
          </p>
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
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <details className="mb-4 max-w-3xl text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Architectural intent
            </summary>
            <MarkdownView
              text={layer.summary}
              className="mt-2 text-sm text-muted-foreground"
            />
          </details>
          {(proof.checks.length > 0 || proof.assets.length > 0) && (
            <details className="mb-4 max-w-3xl">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Verification evidence
              </summary>
              <ProofList
                scope={props.scope}
                context={props.context}
                proof={proof}
                layers={[layer]}
                inLayer
              />
            </details>
          )}
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
            <nav
              aria-label="Walkthrough locations"
              className="shrink-0 lg:w-56"
            >
              <p className="mb-2 text-xs text-muted-foreground">
                {layer.steps.length} code locations · changed and existing
                context
              </p>
              <ol className="space-y-1">
                {layer.steps.map((step, index) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      aria-pressed={step.id === codeStep?.id}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent aria-pressed:bg-accent"
                      onClick={() => setFocus(step.id)}
                    >
                      <span className="text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="min-w-0">
                        <span className="block">{step.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {step.location.state === 'changed'
                            ? 'Code changed'
                            : step.kind === 'context'
                              ? 'Existing context'
                              : layer.lanes[step.lane]}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="min-w-0 flex-1">
              {codeStep && (
                <LayerSteps
                  {...props}
                  layer={layer}
                  steps={[codeStep]}
                  focus={undefined}
                />
              )}
            </div>
          </div>
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
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const changes = useChanges(scope, connection);
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
  const { connection } = context;
  const lines = useChangeLines(
    scope,
    connection,
    step.pointer.path,
    location.startLine,
    location.endLine,
    !changed && Boolean(plain) && (!committed || expanded),
  );
  const contextLines = Option.getOrUndefined(AsyncResult.value(lines));
  const entries: CodeEntry[] = [];
  if (!changed && (!committed || expanded)) {
    const patches =
      plain && contextLines
        ? [
            {
              patch: contextPatch(
                step.pointer.path,
                contextLines.from,
                contextLines.lines,
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
        <span className="text-2xs font-medium uppercase text-muted-foreground">
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
      <div className="my-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {step.kind === 'context' ? 'Existing context' : 'Changed code'} ·
          Excerpt ·{' '}
          {spansLabel([
            {
              startLine: location.startLine ?? step.pointer.startLine,
              endLine: location.endLine ?? step.pointer.endLine,
            },
          ])}
        </span>
        {item && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onOpen({ kind: 'change', path: step.pointer.path })}
          >
            Show all changes in this file
          </Button>
        )}
      </div>
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
            collapsible
            fullHeight
          />
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {AsyncResult.isFailure(lines) || diffs.failed
            ? 'Code could not be loaded.'
            : lines.waiting || diffs.pending
              ? 'Loading code…'
              : 'No textual code at this location. Open the file to inspect it.'}
        </p>
      )}
      <details className="mt-3 border-l-2 border-muted-foreground/30 pl-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          <span className="font-medium">Agent note</span> ·{' '}
          {step.text.length > 150 ? `${step.text.slice(0, 150)}…` : step.text}
        </summary>
        <MarkdownView text={step.text} className="mt-2 text-sm" />
      </details>
    </article>
  );
}
