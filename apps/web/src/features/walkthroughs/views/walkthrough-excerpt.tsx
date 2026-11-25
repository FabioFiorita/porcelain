import { useState } from 'react';
import { FileDiff } from '@pierre/diffs/react';
import { AsyncResult } from 'effect/reactivity';
import { ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/features/preferences/index';
import type { DocumentProps } from '@/features/workspace/index';
import {
  PIERRE_HIGHLIGHTER,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
} from '@/shared/lib/pierre';
import { cn } from '@/shared/lib/utils';
import { PendingSpinner } from '@/shared/views/state-notice';
import type { WalkthroughExcerpt as Excerpt } from '@porcelain/client/walkthroughs/rules';
import { capturedExcerpt } from '../adapters/captured-excerpt';
import { useCapturedWalkthroughPatch } from '../queries/walkthrough';
import { RichText } from './rich-text';
import { useCitedFiles } from './cited-files';

type ExcerptProps = {
  document: DocumentProps;
  runId: string;
  step: number;
  excerpt: Excerpt;
};

function CapturedLines({ document, runId, step, excerpt }: ExcerptProps) {
  const { result, retry } = useCapturedWalkthroughPatch(
    document.scope,
    document.context,
    runId,
    step,
    excerpt.position,
    excerpt.node,
  );
  const { dark } = useTheme();
  if (AsyncResult.isInitial(result))
    return (
      <div className="px-3 py-2">
        <PendingSpinner label="Loading captured lines" />
      </div>
    );
  if (AsyncResult.isFailure(result))
    return (
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 text-ui"
        role="alert"
      >
        <p>The captured diff could not be read.</p>
        <Button size="sm" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  const answer = result.value;
  const file =
    answer.walkthrough?.id === runId && answer.capturedPatch
      ? capturedExcerpt(answer.capturedPatch, excerpt)
      : undefined;
  if (!file)
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-ui">
        <p>These lines are unavailable in the saved walkthrough.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.onOpen({ kind: 'walkthrough-step', step })}
        >
          Open step code
        </Button>
      </div>
    );
  const side = excerpt.side === 'old' ? 'deletions' : 'additions';
  return (
    <FileDiff
      fileDiff={file}
      options={{
        preferredHighlighter: PIERRE_HIGHLIGHTER,
        theme: PIERRE_THEME,
        themeType: dark ? 'dark' : 'light',
        overflow: 'wrap',
        disableFileHeader: true,
        unsafeCSS: PIERRE_SURFACE_CSS,
        diffStyle: 'unified',
      }}
      selectedLines={{
        start: excerpt.start,
        end: excerpt.end,
        side,
        endSide: side,
      }}
    />
  );
}

export function WalkthroughExcerpt(props: ExcerptProps) {
  const [open, setOpen] = useState(true);
  const { excerpt, document } = props;
  const cited = useCitedFiles(document, []);
  const opening = cited.opening(excerpt.path);
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      {excerpt.caption && (
        <figcaption className="text-ui text-foreground-2">
          <RichText text={excerpt.caption} />
        </figcaption>
      )}
      <div className="min-w-0 overflow-hidden rounded-md border">
        <div
          className={cn(
            'flex min-h-8 items-center gap-1 bg-muted/50 pr-1',
            open && 'border-b',
          )}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} the lines: ${excerpt.path} · ${excerpt.lines}`}
            onClick={() => setOpen(!open)}
            className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch px-2 py-1 text-left font-mono text-caption text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronRightIcon
              aria-hidden
              className={cn('size-3.5 shrink-0', open && 'rotate-90')}
            />
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span className="text-foreground wrap-anywhere">
                {excerpt.path}
              </span>
              <span>{excerpt.lines}</span>
            </span>
          </button>
          <Button
            size="sm"
            variant="ghost"
            disabled={opening === undefined}
            onClick={() => cited.open(excerpt.path)}
          >
            Open file
          </Button>
        </div>
        {open && <CapturedLines {...props} />}
      </div>
    </figure>
  );
}
