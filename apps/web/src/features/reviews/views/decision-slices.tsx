import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { PatchDiff } from '@pierre/diffs/react';
import { ArrowUpRightIcon } from 'lucide-react';
import { readReviewRevisionDiffs } from '@porcelain/client/reviews';
import type {
  ReviewLayer,
  ReviewRevision,
  ReviewStep,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/features/preferences/index';
import { PIERRE_DECISION_CSS, PIERRE_THEME } from '@/shared/lib/pierre';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import { retainedDiffPaths } from '../rules/review-file';
import { focusedPatch } from '../rules/focused-patch';

export function DecisionSlices({
  revision,
  context,
  layer,
  onOpenFile,
}: {
  revision: ReviewRevision;
  context: ConnectionContext;
  layer: ReviewLayer;
  onOpenFile: (step: ReviewStep) => void;
}) {
  const files = revision.files.filter((file) =>
    layer.steps.some((step) => step.pointer.path === file.path),
  );
  const result = useAtomValue(
    readReviewRevisionDiffs({
      connection: context.connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
      paths: files.map(retainedDiffPaths),
    }),
  );
  const diffs = Option.getOrUndefined(AsyncResult.value(result));
  const patchFor = (step: ReviewStep) => {
    const content = diffs?.diffs.find((item) =>
      item.paths.includes(step.pointer.path),
    )?.content;
    return content?.kind === 'text'
      ? focusedPatch(content.patch, step.pointer)
      : undefined;
  };
  return (
    <section aria-label="Code slices" className="flex min-w-0 flex-col gap-3">
      {layer.steps.map((step, index) => (
        <article
          key={step.id}
          id={`slice-${step.id}`}
          className="min-w-0 scroll-mt-4 overflow-hidden rounded-lg border"
        >
          <header className="flex min-w-0 items-start gap-3 border-b bg-muted/40 px-3 py-2">
            <span
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border-strong text-2xs font-medium text-muted-foreground tabular-nums',
                step.kind === 'context' && 'border-dashed',
              )}
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm leading-5 font-medium">{step.title}</p>
              <p className="text-sm leading-5 text-foreground-2">{step.text}</p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0"
              onClick={() => onOpenFile(step)}
            >
              <span className="flex max-w-56 min-w-0 font-mono">
                <TruncatedText
                  text={`${step.pointer.path.split('/').at(-1) ?? step.pointer.path}:${step.pointer.startLine}`}
                />
              </span>
              <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </header>
          <Slice
            loading={AsyncResult.isInitial(result)}
            patch={patchFor(step)}
            changed={files.some((file) => file.path === step.pointer.path)}
          />
        </article>
      ))}
    </section>
  );
}

function Slice({
  loading,
  patch,
  changed,
}: {
  loading: boolean;
  patch: string | undefined;
  changed: boolean;
}) {
  const { dark } = useTheme();
  if (loading)
    return (
      <div role="status" className="p-3">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  if (!patch)
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {changed
          ? 'No changed lines in this range. Open the file to read it.'
          : 'Existing code this decision relies on. Open the file to read it.'}
      </p>
    );
  return (
    <div className="max-h-112 overflow-auto">
      <PatchDiff
        patch={patch}
        options={{
          theme: PIERRE_THEME,
          themeType: dark ? 'dark' : 'light',
          diffStyle: 'unified',
          overflow: 'wrap',
          disableFileHeader: true,
          unsafeCSS: PIERRE_DECISION_CSS,
        }}
      />
    </div>
  );
}
