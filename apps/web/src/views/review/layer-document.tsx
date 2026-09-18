import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OpenDocument } from '../../domain/documents';
import {
  type Change,
  changePath,
  type Layers,
  type ReviewScope,
  reviewProgress,
} from '../../domain/review';
import { useChanges, useReviewEvidence } from '../../query/review';
import { DocumentToolbar } from './document-toolbar';
import { GuidedLayerDocument } from './guided-layer';
import { MarkdownView } from './markdown-view';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
import { MarkAllReviewed } from './reviewed-control';

type Layer = Layers['layers'][number];

export function LayerDocument({
  scope,
  layerId,
  onOpen,
}: {
  scope: ReviewScope;
  layerId: string;
  onOpen: OpenDocument;
}) {
  const { status, layers } = useChanges(scope);
  const [allFiles, setAllFiles] = useState(false);
  const layer = layers.layers.find((candidate) => candidate.id === layerId);
  if (!layer)
    return (
      <ReviewEmpty
        title="Layer no longer present"
        description="Choose a layer that is still present in the current review."
      />
    );
  const title = `${layers.layers.indexOf(layer) + 1}. ${layer.title}`;
  if (layer.guide && !allFiles)
    return (
      <GuidedLayerDocument
        scope={scope}
        layerId={layer.id}
        title={title}
        guide={layer.guide}
        changes={status.changes}
        onOpen={onOpen}
        onAllFiles={() => setAllFiles(true)}
      />
    );
  return (
    <LayerFiles
      scope={scope}
      layer={layer}
      title={title}
      changes={status.changes}
      onGuide={() => setAllFiles(false)}
    />
  );
}

function LayerFiles({
  scope,
  layer,
  title,
  changes,
  onGuide,
}: {
  scope: ReviewScope;
  layer: Layer;
  title: string;
  changes: readonly Change[];
  onGuide: () => void;
}) {
  const paths = [...new Set(layer.files.map((file) => file.path))];
  const selected = changes.filter((change) => paths.includes(changePath(change)));
  const evidence = useReviewEvidence(scope, selected);
  const progress = reviewProgress(paths, evidence);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        changes={selected}
        files={layer.files}
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={title}
            subtitle={`Layer · ${paths.length} files · ${progress.done}/${progress.total} reviewed`}
          >
            {layer.guide && (
              <Button size="sm" variant="outline" onClick={onGuide}>
                Guided review
              </Button>
            )}
            {collapseControl}
            <MarkAllReviewed scope={scope} entries={evidence} kind="layer" />
          </DocumentToolbar>
        )}
        header={() =>
          layer.summary == null ? null : (
            <details className="mx-4 mt-3 rounded-xl border px-4 py-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Layer notes
              </summary>
              <MarkdownView
                text={layer.summary}
                className="mt-1 max-w-[78ch] text-muted-foreground"
              />
            </details>
          )
        }
      />
    </div>
  );
}
