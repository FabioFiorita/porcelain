import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OpenDocument } from '../../domain/documents';
import {
  guideSourceStatus,
  type ReviewGuide,
} from '../../domain/guided-review';
import { type Change, changePath, type ReviewScope } from '../../domain/review';
import { useGuidePositionKey, useGuideSource } from '../../query/guided-review';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { GuideSourcePanel } from './guide-source-panel';
import { GuideStepHeader } from './guide-step-header';
import { ReviewCodeDocument } from './review-code-document';
import { useGuidePosition } from './use-guide-position';

type Props = {
  scope: ReviewScope;
  layerId: string;
  title: string;
  guide: ReviewGuide;
  changes: readonly Change[];
  onOpen: OpenDocument;
  onAllFiles: () => void;
};

export function GuidedLayerDocument(props: Props) {
  const positionKey = useGuidePositionKey(props.scope, props.layerId);
  return <GuidedLayer key={positionKey} {...props} positionKey={positionKey} />;
}

function GuidedLayer({
  scope,
  title,
  guide,
  changes,
  onOpen,
  onAllFiles,
  positionKey,
}: Props & { positionKey: string }) {
  const { active } = useDocumentInteraction();
  const { step, select } = useGuidePosition(positionKey, guide);
  const [detail, setDetail] = useState<{
    stepId: string;
    sourceKey: string;
  } | null>(null);
  const [mode, setMode] = useState<'context' | 'diff'>('context');
  const related =
    detail?.stepId === step?.id
      ? step?.related?.find(
          (item) => JSON.stringify(item.source) === detail?.sourceKey,
        )
      : undefined;
  const source = related?.source ?? step?.source;
  const read = useGuideSource(scope, source?.path, active);
  if (!step || !source) return null;
  const index = guide.steps.indexOf(step);
  const selectedChanges = changes.filter(
    (change) => changePath(change) === source.path,
  );
  const current =
    read.kind === 'ready' && guideSourceStatus(source, read.file) === 'current';
  const choose = (id: string) => {
    select(id);
    setDetail(null);
    setMode('context');
  };

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Guided review"
    >
      <DocumentToolbar title={title} subtitle="Behavior and source">
        <Button size="sm" variant="outline" onClick={onAllFiles}>
          All layer files
        </Button>
      </DocumentToolbar>
      <GuideStepHeader
        guide={guide}
        step={step}
        hasRelatedSource={related !== undefined}
        onSelect={choose}
        onRelated={(item) => {
          const selection = item
            ? { stepId: step.id, sourceKey: JSON.stringify(item.source) }
            : null;
          setDetail(selection);
          setMode('context');
        }}
      />
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        <Button
          size="xs"
          variant={mode === 'context' ? 'secondary' : 'ghost'}
          aria-pressed={mode === 'context'}
          onClick={() => setMode('context')}
        >
          Context
        </Button>
        <Button
          size="xs"
          variant={mode === 'diff' ? 'secondary' : 'ghost'}
          aria-pressed={mode === 'diff'}
          onClick={() => setMode('diff')}
        >
          Current diff
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onOpen({ kind: 'file', path: source.path })}
        >
          Open full file
        </Button>
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {source.path}:{source.startLine}-{source.endLine} · Current worktree
        </span>
      </div>
      {mode === 'diff' && !current && (
        <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
          The guide reference is not verified against the current source. This
          is the live diff, not the code captured by the guide.
        </p>
      )}
      {mode === 'context' ? (
        <GuideSourcePanel
          key={JSON.stringify(source)}
          scope={scope}
          source={source}
          read={read}
        />
      ) : selectedChanges.length > 0 ? (
        <ReviewCodeDocument scope={scope} changes={selectedChanges} />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          No current diff for this source. Unchanged files can still explain the
          behavior.
        </p>
      )}
      <footer className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => {
            const previous = guide.steps[index - 1];
            if (previous) choose(previous.id);
          }}
        >
          Previous step
        </Button>
        <span className="text-center text-[11px] text-muted-foreground">
          Step {index + 1} of {guide.steps.length}. Reading position, not
          approval.
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={index === guide.steps.length - 1}
          onClick={() => {
            const next = guide.steps[index + 1];
            if (next) choose(next.id);
          }}
        >
          Next step
        </Button>
      </footer>
    </section>
  );
}
