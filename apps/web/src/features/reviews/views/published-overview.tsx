import { useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { desktopAppAddress } from '@/shared/adapters/desktop';
import { useTheme } from '@/shared/workspace/theme';
import { useSummaryLayerRequests } from '../adapters/summary-messages';
import type { OpenDocument } from '../rules/documents';
import { type ReviewResponse, reviewSummaryUrl } from '../rules/review';
import { DocumentToolbar } from './document-toolbar';
import type { Graph } from './review-diagram';
import { ReviewDiagram } from './lazy-review-diagram';

export function PublishedOverview({
  review,
  address,
  onOpen,
}: {
  review: ReviewResponse;
  address: string;
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
        <SummaryFrame review={review} address={address} onOpen={onOpen} />
      )}
    </section>
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
