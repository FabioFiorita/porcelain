import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OpenDocument } from '../../domain/documents';
import {
  guideSourceStatus,
  type ReviewGuide,
} from '../../domain/guided-review';
import { type Change, changePath, type ReviewScope } from '../../domain/review';
import {
  useGuidePositionKey,
  useGuideSource,
} from '../../query/guided-review';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { GuideSourcePanel } from './guide-source-panel';
import { MarkdownView } from './markdown-view';
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
    read.kind === 'ready' &&
    guideSourceStatus(source, read.file) === 'current';
  const choose = (id: string) => {
    select(id);
    setDetail(null);
    setMode('context');
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Guided review">
      <DocumentToolbar title={title} subtitle="Behavior and source">
        <Button size="sm" variant="outline" onClick={onAllFiles}>
          All layer files
        </Button>
      </DocumentToolbar>
      <div className="max-h-[45%] shrink-0 overflow-auto border-b px-4 py-3">
        <p className="text-[11px] text-muted-foreground">Agent-authored guide</p>
        <p className="mt-1 max-w-[78ch] text-sm">{guide.purpose}</p>
        <nav aria-label="Review path" className="mt-3 overflow-x-auto">
          <ol className="flex w-max gap-1">
            {guide.steps.map((item, stepIndex) => (
              <li key={item.id}>
                <Button
                  size="sm"
                  variant={item.id === step.id ? 'secondary' : 'ghost'}
                  aria-current={item.id === step.id ? 'step' : undefined}
                  onClick={() => choose(item.id)}
                >
                  {stepIndex + 1}. {item.title}
                </Button>
              </li>
            ))}
          </ol>
        </nav>
        <h2 className="mt-3 text-sm font-medium">{step.question}</h2>
        {step.note && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer">Why this matters</summary>
            <MarkdownView text={step.note} className="max-w-[78ch]" />
          </details>
        )}
        {(step.related?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground">Related source:</span>
            {step.related?.map((item) => (
              <Button
                key={JSON.stringify([item.title, item.source])}
                size="xs"
                variant="ghost"
                onClick={() => {
                  setDetail({
                    stepId: step.id,
                    sourceKey: JSON.stringify(item.source),
                  });
                  setMode('context');
                }}
              >
                {item.title}
              </Button>
            ))}
            {related && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setDetail(null);
                  setMode('context');
                }}
              >
                Back to {step.title}
              </Button>
            )}
          </div>
        )}
        {step.verification && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer">Verification notes</summary>
            <p className="mt-2 text-muted-foreground">
              Agent-provided. Not independently verified by Porcelain.
            </p>
            <MarkdownView text={step.verification} className="max-w-[78ch]" />
          </details>
        )}
      </div>
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
          No current diff for this source. Unchanged files can still explain
          the behavior.
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
