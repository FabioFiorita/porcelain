import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { desktopAppAddress } from '@/shared/adapters/desktop';
import { useTheme } from '@/features/preferences/index';
import { useSummaryLayerRequests } from '../adapters/summary-messages';
import type { OpenDocument } from '../rules/documents';
import {
  type ReviewResponse,
  reviewSummaryUrl,
  componentRelationships,
  componentNeighborhood,
  type Diagram,
  type DiagramBox,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { DocumentToolbar } from './document-toolbar';
import type { Graph } from './review-diagram';
import { ReviewDiagram } from './lazy-review-diagram';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useReviewUnderstanding } from '../queries/understanding';
import { ReviewProgress } from './review-progress';

export function PublishedOverview({
  review,
  address,
  onOpen,
  scope,
  context,
  onRefresh,
}: {
  review: ReviewResponse;
  address: string;
  onOpen: OpenDocument;
  scope: ReviewScope;
  context: ConnectionContext;
  onRefresh: () => void;
}) {
  const [view, setView] = useState('architecture');
  const [previousSummary, setPreviousSummary] =
    useState<ReviewResponse['summary']>();
  const [version, setVersion] = useState('after');
  const [selected, setSelected] = useState<string>();
  const [focused, setFocused] = useState(false);
  const diagram =
    version === 'before' ? review.diagram?.before : review.diagram?.after;
  const selectComponent = (id: string | undefined) => {
    setSelected(id);
    setFocused(id !== undefined);
  };
  const visible =
    diagram && focused && selected
      ? componentNeighborhood(diagram, selected)
      : diagram;
  const graph: Graph | undefined = visible && {
    ...visible,
    arrows:
      focused && selected
        ? visible.arrows
            .filter((arrow) => arrow.from === selected || arrow.to === selected)
            .map((arrow) => ({ ...arrow, label: undefined }))
        : [],
    ...(focused && selected ? { trace: selected } : {}),
    boxes: visible.boxes.map((box) => ({
      ...box,
      detail: undefined,
      problem: undefined,
      clickable: true,
      selected: box.id === selected,
    })),
  };
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Published review"
    >
      <DocumentToolbar
        title="Review"
        subtitle="How this change shapes the system"
      >
        <Tabs
          value={view}
          onValueChange={(next: string) => {
            if (next === 'summary') {
              setPreviousSummary(review.summary);
              onRefresh();
            }
            setView(next);
          }}
          aria-label="Review presentation"
        >
          <TabsList>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="summary">Agent summary</TabsTrigger>
          </TabsList>
        </Tabs>
      </DocumentToolbar>
      <ReviewProgress
        review={review}
        scope={scope}
        context={context}
        onOpen={onOpen}
      />
      {review.diagnostics === 'unavailable' && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          The worktree is unavailable. This is the saved review; code locations
          and coverage could not be checked.
        </p>
      )}
      {view === 'architecture' ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Architecture map"
            className="flex min-h-64 min-w-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2">
              <p className="text-xs text-muted-foreground">
                Select a component to trace its relationships
              </p>
              {review.diagram?.before && (
                <Tabs
                  className="self-start"
                  value={version}
                  onValueChange={setVersion}
                  aria-label="Diagram version"
                >
                  <TabsList>
                    <TabsTrigger value="before">Before</TabsTrigger>
                    <TabsTrigger value="after">After</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            {diagram && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3.5 py-2">
                <NativeSelect
                  size="sm"
                  aria-label="Select architecture component"
                  value={
                    diagram.boxes.some((box) => box.id === selected)
                      ? selected
                      : ''
                  }
                  onChange={(event) =>
                    selectComponent(event.target.value || undefined)
                  }
                  className="max-w-full"
                >
                  <NativeSelectOption value="">
                    Select a component
                  </NativeSelectOption>
                  {diagram.boxes.map((box) => (
                    <NativeSelectOption key={box.id} value={box.id}>
                      {box.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-pressed={focused}
                  disabled={
                    !selected ||
                    !diagram.boxes.some((box) => box.id === selected)
                  }
                  onClick={() => setFocused((value) => !value)}
                >
                  {focused ? 'Show entire map' : 'Focus on selection'}
                </Button>
                <span role="status" className="text-xs text-muted-foreground">
                  Showing {visible?.boxes.length} of {diagram.boxes.length}{' '}
                  components
                </span>
              </div>
            )}
            {graph ? (
              <ReviewDiagram
                graph={graph}
                onBoxClick={(box) => selectComponent(box.id)}
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                No architecture map was published. Explore the walkthroughs and
                their code.
              </p>
            )}
          </section>
          <ArchitectureInspector
            review={review}
            diagram={diagram}
            selected={selected}
            scope={scope}
            context={context}
            onOpen={onOpen}
            onSelect={selectComponent}
          />
        </div>
      ) : review.summary === previousSummary ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          Refreshing summary…
        </p>
      ) : (
        <SummaryFrame review={review} address={address} onOpen={onOpen} />
      )}
    </section>
  );
}

function ArchitectureInspector({
  review,
  diagram,
  selected,
  scope,
  context,
  onOpen,
  onSelect,
}: {
  review: ReviewResponse;
  diagram: Diagram | undefined;
  selected: string | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  onOpen: OpenDocument;
  onSelect: (id: string | undefined) => void;
}) {
  const progress = useReviewUnderstanding(scope, context, review.layers);
  const box = diagram?.boxes.find((candidate) => candidate.id === selected);
  const layer = review.layers.find(
    (candidate) => candidate.id === box?.layerId,
  );
  return (
    <aside
      aria-label="Architecture details"
      className="max-h-[35vh] shrink-0 overflow-auto border-t p-4 lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96"
    >
      {box && (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold">{box.label}</h2>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSelect(undefined)}
            >
              Clear selection
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {diagram?.lanes[box.lane]} · {box.change ?? 'Existing'} component
          </p>
          {box.detail && <p className="mt-3 text-sm">{box.detail}</p>}
          {box.problem && (
            <p className="mt-3 text-sm text-destructive">{box.problem}</p>
          )}
          {diagram && (
            <Relationships diagram={diagram} box={box} onSelect={onSelect} />
          )}
          {layer ? (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal text-left"
                onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
              >
                Follow {layer.title}
              </Button>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Walkthrough code · {layer.steps.length} locations
                </summary>
                <ul className="mt-2 space-y-2">
                  {layer.steps.map((step) => (
                    <li key={step.id}>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-auto max-w-full whitespace-normal break-all text-left"
                        onClick={() =>
                          onOpen(
                            { kind: 'file', path: step.pointer.path },
                            {
                              kind: 'codeRange',
                              filePath: step.pointer.path,
                              startLine: step.pointer.startLine,
                              endLine: step.pointer.endLine,
                              comparison: { kind: 'file' },
                            },
                          )
                        }
                      >
                        {step.pointer.path}:{step.pointer.startLine}–
                        {step.pointer.endLine}
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              This component has no linked code walkthrough.
            </p>
          )}
          <hr className="my-5" />
        </>
      )}
      <h2 className="text-sm font-semibold">Explore the change</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Behaviors and architectural decisions, with their code.
      </p>
      <ol className="mt-3 space-y-1">
        {progress.states.map(({ layer: item, reviewed, stale }, index) => (
          <li key={item.id}>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start text-left"
              onClick={() => onOpen({ kind: 'layer', layerId: item.id })}
            >
              <span className="text-xs text-muted-foreground">
                {reviewed ? '✓' : `${index + 1}.`}
              </span>
              <span className="min-w-0 whitespace-normal">
                <span className="block">{item.title}</span>
                {stale && (
                  <span className="text-xs text-graph-4">
                    Code changed · explanation needs updating
                  </span>
                )}
              </span>
            </Button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function Relationships({
  diagram,
  box,
  onSelect,
}: {
  diagram: Diagram;
  box: DiagramBox;
  onSelect: (id: string) => void;
}) {
  const connections = componentRelationships(diagram, box.id);
  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium">Relationships</h3>
      {connections.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No relationships described.
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {connections.map(({ other, outgoing, label }, index) => (
            <li key={`${other.id}:${index}`}>
              <Button
                variant="ghost"
                size="xs"
                className="h-auto w-full justify-start whitespace-normal text-left"
                onClick={() => onSelect(other.id)}
              >
                {outgoing
                  ? `${label} → ${other.label}`
                  : `${other.label} → ${label}`}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryFrame({
  review,
  address,
  onOpen,
}: {
  review: ReviewResponse;
  address: string;
  onOpen: OpenDocument;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { dark } = useTheme();
  useSummaryLayerRequests(frame, (layerNumber) => {
    const layer = review.layers[layerNumber - 1];
    if (layer) onOpen({ kind: 'layer', layerId: layer.id });
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
