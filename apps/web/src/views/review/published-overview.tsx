import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type OpenDocument, UNEXPLAINED } from '../../domain/documents';
import { notExplainedLabel, type ReviewResponse } from '../../domain/review';
import { useTheme } from '../workspace/theme';
import { DocumentToolbar } from './document-toolbar';
import { MarkdownView } from './markdown-view';
import { type Graph, ReviewDiagram } from './review-diagram';

export function PublishedOverview({
  review,
  onOpen,
}: {
  review: ReviewResponse;
  onOpen: OpenDocument;
}) {
  const [view, setView] = useState('summary');
  const [version, setVersion] = useState('after');
  const diagram =
    version === 'before' ? review.diagram?.before : review.diagram?.after;
  const graph: Graph | undefined = diagram && {
    ...diagram,
    boxes: diagram.boxes.map((box) => ({
      ...box,
      clickable: Boolean(box.layerId),
    })),
  };
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Published review"
    >
      <DocumentToolbar
        title="Review"
        subtitle={`${review.layers.length} layers`}
      >
        {review.diagram && (
          <Tabs
            value={view}
            onValueChange={setView}
            aria-label="Review presentation"
          >
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </DocumentToolbar>
      {review.diagnostics === 'unavailable' && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          The worktree is unavailable. This is the saved review; code locations
          and coverage could not be checked.
        </p>
      )}
      {view === 'graph' && graph ? (
        <>
          {review.diagram?.before && (
            <Tabs
              className="self-start p-2"
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
          <ReviewDiagram
            graph={graph}
            onBoxClick={(box) => {
              if (
                box.layerId &&
                review.layers.some((layer) => layer.id === box.layerId)
              )
                onOpen({ kind: 'layer', layerId: box.layerId });
            }}
          />
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <SummaryFrame review={review} onOpen={onOpen} />
          <div className="mx-auto max-w-4xl space-y-6 p-4">
            <section aria-label="Review layers" className="space-y-2">
              {review.layers.map((layer, index) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
                  className="block w-full rounded-lg bg-muted/30 p-3 text-left hover:bg-accent"
                >
                  <h2 className="text-sm font-medium">
                    {index + 1}. {layer.title}
                  </h2>
                  <MarkdownView
                    text={layer.summary}
                    className="mt-1 text-sm text-muted-foreground"
                  />
                </button>
              ))}
            </section>
            {review.notExplained.length > 0 && (
              <Button
                variant="outline"
                className="h-auto justify-start whitespace-normal text-left"
                onClick={() => onOpen(UNEXPLAINED)}
              >
                Not explained
                <span className="text-muted-foreground">
                  {' · '}
                  {notExplainedLabel(review.notExplained)}
                </span>
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryFrame({
  review,
  onOpen,
}: {
  review: ReviewResponse;
  onOpen: OpenDocument;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { dark } = useTheme();
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frame.current?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object'
      )
        return;
      const message = event.data as { source?: unknown; openLayer?: unknown };
      if (
        message.source !== 'porcelain-summary' ||
        typeof message.openLayer !== 'number' ||
        !Number.isInteger(message.openLayer)
      )
        return;
      const layer = review.layers[message.openLayer - 1];
      if (layer) onOpen({ kind: 'layer', layerId: layer.id });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [review.layers, onOpen]);
  return (
    <iframe
      ref={frame}
      title="Review summary"
      src={`${review.summary.url}#theme=${dark ? 'dark' : 'light'}`}
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      referrerPolicy="no-referrer"
      className="block min-h-[28rem] w-full border-0"
      style={{ colorScheme: dark ? 'dark' : 'light' }}
    />
  );
}
