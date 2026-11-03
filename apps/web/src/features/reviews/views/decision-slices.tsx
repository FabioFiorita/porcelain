import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { File, PatchDiff } from '@pierre/diffs/react';
import { ArrowUpRightIcon } from 'lucide-react';
import type {
  ReviewLayer,
  ReviewMarks,
  ReviewRevision,
  ReviewStep,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/features/preferences/index';
import {
  createPierreFileOptions,
  PIERRE_DECISION_CSS,
  PIERRE_THEME,
} from '@/shared/lib/pierre';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useRevisionDiffs } from '../queries/revision-diffs';
import type { WalkthroughProps } from './walkthrough-props';
import { RevisionFileMark } from './revision-file-mark';
import { GuardRequest } from './guard-request';
import { focusedPatch } from '../rules/focused-patch';

export function DecisionSlices({
  revision,
  context,
  scope,
  marks,
  layer,
  onOpenFile,
}: {
  revision: ReviewRevision;
  context: ConnectionContext;
  scope: WalkthroughProps['scope'];
  layer: ReviewLayer;
  marks: ReviewMarks;
  onOpenFile: (step: ReviewStep) => void;
}) {
  const files = revision.files.filter((file) =>
    layer.steps.some((step) => step.pointer.path === file.path),
  );
  const result = useRevisionDiffs(revision, context.connection, files);
  const diffs = Option.getOrUndefined(AsyncResult.value(result));
  const patchFor = (step: ReviewStep) => {
    const content = diffs?.diffs.find((item) =>
      item.paths.includes(step.pointer.path),
    )?.content;
    return step.kind === 'changed' && content?.kind === 'text'
      ? focusedPatch(content.patch, step.pointer)
      : undefined;
  };
  return (
    <section aria-label="Code slices" className="flex min-w-0 flex-col gap-3">
      {layer.steps.map((step, index) => {
        const file = files.find((file) => file.path === step.pointer.path);
        const first =
          layer.steps.find(
            (candidate) => candidate.pointer.path === step.pointer.path,
          )?.id === step.id;
        return (
          <article
            key={step.id}
            id={`slice-${step.id}`}
            aria-label={`Step ${step.title}`}
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
                <p className="text-sm leading-5 text-foreground-2">
                  {step.text}
                </p>
              </div>
              {file && first && (
                <RevisionFileMark
                  file={file}
                  revision={revision}
                  context={context}
                  marks={marks}
                />
              )}
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                aria-label={`Open ${step.pointer.path} at line ${step.pointer.startLine}`}
                title={`${step.pointer.path}:${step.pointer.startLine}–${step.pointer.endLine}`}
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
              step={step}
            />
            <GuardRequest
              step={step}
              revision={revision}
              scope={scope}
              context={context}
            />
          </article>
        );
      })}
    </section>
  );
}

function Slice({
  loading,
  patch,
  step,
}: {
  loading: boolean;
  patch: string | undefined;
  step: ReviewStep;
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
      <div className="max-h-112 overflow-auto">
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Saved excerpt · {step.pointer.path}:{step.pointer.startLine}–
          {step.pointer.endLine}
        </p>
        {step.published && step.published.length > 0 ? (
          <File
            file={{
              name: step.pointer.path,
              contents: step.published.join('\n'),
            }}
            options={{
              ...createPierreFileOptions(dark ? 'dark' : 'light', {
                overflow: 'wrap',
              }),
              disableFileHeader: true,
              disableLineNumbers: true,
            }}
          />
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No saved code in this range. Open the file to read it.
          </p>
        )}
      </div>
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
