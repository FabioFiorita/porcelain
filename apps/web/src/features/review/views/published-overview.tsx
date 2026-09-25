import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OpenDocument } from '@/features/review/model/documents';
import {
  reviewSummaryUrl,
  type ReviewResponse,
} from '@/features/review/model/review';
import { useTheme } from '@/shared/workspace/theme';
import { DocumentToolbar } from './document-toolbar';
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
        <SummaryFrame review={review} onOpen={onOpen} />
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
      src={`${reviewSummaryUrl(review.summary)}#theme=${dark ? 'dark' : 'light'}`}
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      referrerPolicy="no-referrer"
      className="block min-h-0 w-full flex-1 border-0"
      style={{ colorScheme: dark ? 'dark' : 'light' }}
    />
  );
}
