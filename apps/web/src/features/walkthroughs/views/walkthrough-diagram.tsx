import { useId, useState, type KeyboardEvent } from 'react';
import {
  ChevronRightIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import {
  commentsAt,
  nodeCommentCounts,
} from '@porcelain/client/comments/rules';
import { CommentThread, useComments } from '@/features/comments/index';
import {
  diagramEdgeTone,
  diagramNeighbours,
  diagramNodeDescription,
  diagramNodeSign,
  diagramStep,
  diagramTextMeasure,
  layoutDiagram,
  type DiagramKey,
  type StepDiagram,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import type { DocumentProps } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useCitedFiles } from './cited-files';
import { WalkthroughExcerpt } from './walkthrough-excerpt';

const MEASURE = diagramTextMeasure({
  label: 8.1,
  note: 5.6,
  edge: 5.4,
  padding: 24,
  sign: 12,
  chevron: 16,
  min: 88,
  max: 232,
});
const LABEL_PAD = 4;

const KEYS: Record<string, DiagramKey> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'first',
  End: 'last',
};

function useFrameWidth() {
  const [width, setWidth] = useState(0);
  const [frame] = useState(() => (element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  });
  return { frame, width };
}

function DiagramFile({
  document,
  path,
  note,
}: {
  document: DocumentProps;
  path: string;
  note: string | undefined;
}) {
  const cited = useCitedFiles(document, [path]);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {note && <p className="text-ui text-foreground-2">{note}</p>}
      <div className="flex min-h-8 min-w-0 items-center gap-1 rounded-md border bg-muted/50 pr-1 pl-3">
        <span className="min-w-0 flex-1 font-mono text-caption text-foreground wrap-anywhere">
          {path}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={cited.opening(path) === undefined}
          onClick={() => cited.open(path)}
        >
          Open file
        </Button>
      </div>
    </div>
  );
}

function NodeComments({
  document,
  title,
  node,
}: {
  document: DocumentProps;
  title: string;
  node: string;
}) {
  const owner = { scope: document.scope, context: document.context };
  const { view } = useComments(owner);
  const [composing, setComposing] = useState(false);
  const drafts = commentsAt(
    view,
    (anchor) =>
      anchor.kind === 'node' && anchor.title === title && anchor.node === node,
  );
  return (
    <div className="flex flex-col gap-2">
      <CommentThread
        owner={owner}
        drafts={drafts}
        anchor={{ kind: 'node', title, node }}
        composing={composing}
        onClose={() => setComposing(false)}
      />
      {!composing && (
        <span>
          <Button size="sm" variant="ghost" onClick={() => setComposing(true)}>
            <MessageSquarePlusIcon data-icon="inline-start" />
            Comment on {node}
          </Button>
        </span>
      )}
    </div>
  );
}

function useNodeCommentCounts(document: DocumentProps, title: string) {
  const { view } = useComments({
    scope: document.scope,
    context: document.context,
  });
  return nodeCommentCounts(view, title);
}

export function WalkthroughDiagram({
  diagram,
  document,
  runId,
  step,
  title,
}: {
  diagram: StepDiagram;
  document: DocumentProps;
  runId: string;
  step: number;
  title: string;
}) {
  const commented = useNodeCommentCounts(document, title);
  const { frame, width } = useFrameWidth();
  const geometry = layoutDiagram(
    diagram,
    MEASURE,
    width === 0 ? Infinity : width,
  );
  const [current, setCurrent] = useState(diagram.nodes[0]?.id ?? '');
  const [hovered, setHovered] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const [chosen, setChosen] = useState<string>();
  const detail = useId();
  const active = hovered ?? focused;
  const near =
    active === undefined ? undefined : diagramNeighbours(diagram, active);
  const chosenNode = diagram.nodes.find((node) => node.id === chosen);
  const fits = geometry.width <= width;
  const labelX = (x: number, text: string) => {
    const half = MEASURE.label(text) / 2 + LABEL_PAD;
    return Math.min(Math.max(x, half), geometry.width - half);
  };

  const move = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && chosen !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      setChosen(undefined);
      return;
    }
    const key = KEYS[event.key];
    if (key === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const next = diagramStep(geometry, current, key);
    setCurrent(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-node="${CSS.escape(next)}"]`)
      ?.focus();
  };

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="min-w-0 overflow-hidden rounded-md border">
        {diagram.title && (
          <figcaption className="flex min-h-8 items-center border-b bg-muted/50 px-3 py-1 text-caption text-muted-foreground">
            {diagram.title}
          </figcaption>
        )}
        <div ref={frame} className="min-w-0 overflow-x-auto">
          <div
            className={cn('relative', fits && 'mx-auto')}
            style={{ width: geometry.width, height: geometry.height }}
          >
            <svg
              aria-hidden
              width={geometry.width}
              height={geometry.height}
              className="absolute inset-0 overflow-visible"
            >
              {geometry.lifelines.map((line, index) => (
                <line
                  key={index}
                  x1={line.x}
                  x2={line.x}
                  y1={line.top}
                  y2={line.bottom}
                  className="stroke-border"
                />
              ))}
              {geometry.edges.map((placed) => {
                const edge = diagram.edges[placed.index];
                if (edge === undefined) return null;
                const lit = near?.edges.has(placed.index) === true;
                const dim = near !== undefined && !lit;
                const tone = diagramEdgeTone(edge, lit);
                return (
                  <g
                    key={placed.index}
                    className={cn(
                      'transition-opacity duration-100',
                      dim && 'opacity-25',
                    )}
                  >
                    <path
                      d={placed.path}
                      fill="none"
                      strokeWidth={1}
                      strokeDasharray={
                        edge.mark === 'removed' ? '4 3' : undefined
                      }
                      className={cn(
                        tone === 'add' && 'stroke-add-fg',
                        tone === 'del' && 'stroke-del-fg',
                        tone === 'lit' && 'stroke-foreground',
                        tone === 'rest' && 'stroke-muted-foreground/60',
                      )}
                    />
                    <polygon
                      points={placed.arrow}
                      className={cn(
                        tone === 'add' && 'fill-add-fg',
                        tone === 'del' && 'fill-del-fg',
                        tone === 'lit' && 'fill-foreground',
                        tone === 'rest' && 'fill-muted-foreground/60',
                      )}
                    />
                  </g>
                );
              })}
            </svg>
            <ul
              aria-label={diagram.title ?? 'Diagram'}
              className="absolute inset-0"
              onKeyDown={move}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setFocused(undefined);
              }}
            >
              {geometry.nodes.map((placed) => {
                const node = diagram.nodes.find(
                  (item) => item.id === placed.id,
                );
                if (node === undefined) return null;
                const sign = diagramNodeSign(node);
                const isChosen = chosen === node.id;
                const dim = near !== undefined && !near.nodes.has(node.id);
                const code = node.kind !== 'external';
                const body = (
                  <>
                    <span className="flex min-w-0 items-baseline gap-1 text-caption">
                      {sign && (
                        <span
                          aria-hidden
                          className={cn(
                            'w-2 shrink-0 font-mono',
                            node.mark === 'added' && 'text-add-fg',
                            node.mark === 'removed' && 'text-del-fg',
                            node.mark === 'changed' && 'text-muted-foreground',
                          )}
                        >
                          {sign}
                        </span>
                      )}
                      <TruncatedText
                        text={node.label}
                        className={cn(
                          'min-w-0 flex-1',
                          code && 'font-mono',
                          node.mark === 'removed' &&
                            'text-muted-foreground line-through',
                          node.mark === 'unchanged' && 'text-foreground-2',
                        )}
                      />
                      {node.anchor && (
                        <ChevronRightIcon
                          aria-hidden
                          className={cn(
                            'size-3 shrink-0 self-center text-muted-foreground',
                            isChosen && 'rotate-90 text-foreground',
                          )}
                        />
                      )}
                    </span>
                    {node.note && (
                      <span className="flex min-w-0 text-2xs">
                        <TruncatedText
                          text={node.note}
                          className={cn(
                            'min-w-0 flex-1 text-muted-foreground',
                            sign && 'pl-3',
                          )}
                        />
                      </span>
                    )}
                    <span className="sr-only">
                      {' '}
                      {diagramNodeDescription(diagram, node)}
                    </span>
                  </>
                );
                const shared = {
                  'data-node': node.id,
                  tabIndex: node.id === current ? 0 : -1,
                  onFocus: () => {
                    setCurrent(node.id);
                    setFocused(node.id);
                  },
                  onPointerEnter: () => setHovered(node.id),
                  onPointerLeave: () => setHovered(undefined),
                  className: cn(
                    'flex size-full flex-col justify-center gap-0.5 rounded-md border px-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    node.mark === 'added' && 'border-add-fg/40 bg-add-bg',
                    node.mark === 'removed' &&
                      'border-dashed border-del-fg/50 bg-card',
                    node.mark !== 'added' &&
                      node.mark !== 'removed' &&
                      'bg-card',
                    node.anchor
                      ? 'cursor-pointer shadow-row hover:border-foreground/40'
                      : 'cursor-default',
                    isChosen &&
                      'border-foreground/60 ring-1 ring-foreground/20',
                  ),
                };
                return (
                  <li
                    key={node.id}
                    className={cn(
                      'absolute transition-opacity duration-100',
                      dim && 'opacity-35',
                    )}
                    style={{
                      left: placed.x,
                      top: placed.y,
                      width: placed.width,
                      height: placed.height,
                    }}
                  >
                    {commented.has(node.label) && (
                      <span
                        role="img"
                        aria-label={`${commented.get(node.label)} comments`}
                        className="pointer-events-none absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border bg-card text-muted-foreground"
                      >
                        <MessageSquareIcon aria-hidden className="size-2.5" />
                      </span>
                    )}
                    {node.anchor ? (
                      <button
                        type="button"
                        {...shared}
                        aria-expanded={isChosen}
                        aria-controls={isChosen ? detail : undefined}
                        onClick={() => {
                          setCurrent(node.id);
                          setChosen(isChosen ? undefined : node.id);
                        }}
                      >
                        {body}
                      </button>
                    ) : (
                      <div {...shared}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <svg
              aria-hidden
              width={geometry.width}
              height={geometry.height}
              className="pointer-events-none absolute inset-0 overflow-visible"
            >
              {geometry.edges.map((placed) => {
                const edge = diagram.edges[placed.index];
                if (!placed.label || !edge?.label) return null;
                const lit = near?.edges.has(placed.index) === true;
                const tone = diagramEdgeTone(edge, lit);
                return (
                  <text
                    key={placed.index}
                    x={labelX(placed.label.x, edge.label)}
                    y={placed.label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    paintOrder="stroke"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    className={cn(
                      'stroke-card text-2xs transition-opacity duration-100',
                      near !== undefined && !lit && 'opacity-25',
                      tone === 'add' && 'fill-add-fg',
                      tone === 'del' && 'fill-del-fg',
                      tone === 'lit' && 'fill-foreground',
                      tone === 'rest' && 'fill-muted-foreground',
                    )}
                  >
                    {edge.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
      {chosenNode?.anchor && (
        <div id={detail} className="flex min-w-0 flex-col gap-2">
          {chosenNode.anchor.kind === 'lines' ? (
            <WalkthroughExcerpt
              key={chosenNode.id}
              document={document}
              runId={runId}
              step={step}
              excerpt={chosenNode.anchor.excerpt}
            />
          ) : (
            <DiagramFile
              key={chosenNode.id}
              document={document}
              path={chosenNode.anchor.path}
              note={chosenNode.note}
            />
          )}
          <NodeComments
            key={`comments:${chosenNode.id}`}
            document={document}
            title={title}
            node={chosenNode.label}
          />
        </div>
      )}
    </figure>
  );
}
