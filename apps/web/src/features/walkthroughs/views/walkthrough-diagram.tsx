import { useId, useState, type KeyboardEvent } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import {
  diagramConnections,
  diagramNeighbours,
  diagramStep,
  growthSign,
  layoutDiagram,
  type DiagramKey,
  type DiagramMeasure,
  type DiagramNode,
  type StepDiagram,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import type { DocumentProps } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useCitedFiles } from './cited-files';
import { WalkthroughExcerpt } from './walkthrough-excerpt';

const MONO_CHARACTER = 8.1;
const NOTE_CHARACTER = 5.6;
const EDGE_CHARACTER = 5.4;
const CARD_PADDING = 24;
const SIGN_WIDTH = 12;
const CHEVRON_WIDTH = 16;
const CARD_MIN = 88;
const CARD_MAX = 232;

const MEASURE: DiagramMeasure = {
  node: (node) => {
    const sign = node.mark && node.mark !== 'unchanged' ? SIGN_WIDTH : 0;
    const label =
      sign +
      node.label.length * MONO_CHARACTER +
      (node.anchor ? CHEVRON_WIDTH : 0);
    const note = node.note ? sign + node.note.length * NOTE_CHARACTER : 0;
    return {
      width: Math.round(
        Math.min(
          CARD_MAX,
          Math.max(CARD_MIN, Math.max(label, note) + CARD_PADDING),
        ),
      ),
      height: node.note ? 44 : 30,
    };
  },
  label: (text) => text.length * EDGE_CHARACTER + 8,
};

const KEYS: Record<string, DiagramKey> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'first',
  End: 'last',
};

const MARK_WORDS: Record<NonNullable<DiagramNode['mark']>, string> = {
  added: 'new',
  changed: 'changed',
  removed: 'removed',
  unchanged: 'unchanged',
};

function nodeSign(node: DiagramNode) {
  return node.mark === undefined || node.mark === 'unchanged'
    ? undefined
    : growthSign({ change: node.mark, what: '', note: '' });
}

function nodeDescription(diagram: StepDiagram, node: DiagramNode) {
  const facts = [
    node.kind,
    node.mark === undefined ? undefined : MARK_WORDS[node.mark],
  ].filter(Boolean);
  const connections = diagramConnections(diagram, node.id);
  let anchor = '';
  if (node.anchor?.kind === 'lines')
    anchor = `Shows ${node.anchor.excerpt.path}, ${node.anchor.excerpt.lines}.`;
  if (node.anchor?.kind === 'file') anchor = `Shows ${node.anchor.path}.`;
  return [
    facts.length > 0 ? `${facts.join(', ')}.` : '',
    connections.length > 0 ? `${connections.join('; ')}.` : '',
    anchor,
  ]
    .filter(Boolean)
    .join(' ');
}

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

type EdgeTone = 'add' | 'del' | 'lit' | 'rest';

function edgeTone(edge: StepDiagram['edges'][number], lit: boolean): EdgeTone {
  if (edge.mark === 'added') return 'add';
  if (edge.mark === 'removed') return 'del';
  return lit ? 'lit' : 'rest';
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

export function WalkthroughDiagram({
  diagram,
  document,
  runId,
  step,
}: {
  diagram: StepDiagram;
  document: DocumentProps;
  runId: string;
  step: number;
}) {
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
                const tone = edgeTone(edge, lit);
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
                    {placed.label && edge.label && (
                      <text
                        x={placed.label.x}
                        y={placed.label.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        paintOrder="stroke"
                        strokeWidth={4}
                        strokeLinejoin="round"
                        className={cn(
                          'stroke-card text-2xs',
                          tone === 'add' && 'fill-add-fg',
                          tone === 'del' && 'fill-del-fg',
                          tone === 'lit' && 'fill-foreground',
                          tone === 'rest' && 'fill-muted-foreground',
                        )}
                      >
                        {edge.label}
                      </text>
                    )}
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
                const sign = nodeSign(node);
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
                      {nodeDescription(diagram, node)}
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
          </div>
        </div>
      </div>
      {chosenNode?.anchor && (
        <div id={detail} className="min-w-0">
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
        </div>
      )}
    </figure>
  );
}
