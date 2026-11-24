import { useState } from 'react';
import { FileDiff } from '@pierre/diffs/react';
import { AsyncResult } from 'effect/reactivity';
import { ArrowLeftIcon, ArrowDownRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTheme } from '@/features/preferences/index';
import type { DocumentProps } from '@/features/workspace/index';
import {
  PIERRE_HIGHLIGHTER,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
} from '@/shared/lib/pierre';
import { PendingSpinner } from '@/shared/views/state-notice';
import type { WalkthroughExcerpt as Excerpt } from '@porcelain/client/walkthroughs/rules';
import { capturedExcerpt } from '../adapters/captured-excerpt';
import { useCapturedWalkthroughPatch } from '../queries/walkthrough';
import { RichText } from './rich-text';

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
  );
  const { dark } = useTheme();
  if (AsyncResult.isInitial(result))
    return <PendingSpinner label="Loading captured lines" />;
  if (AsyncResult.isFailure(result))
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-prose"
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
      <div className="flex flex-col items-start gap-3 text-prose">
        <p>These lines are unavailable in the saved walkthrough.</p>
        <DialogClose
          render={<Button variant="outline" size="sm" />}
          onClick={() => document.onOpen({ kind: 'walkthrough-step', step })}
        >
          Open step code
        </DialogClose>
      </div>
    );
  const side = excerpt.side === 'old' ? 'deletions' : 'additions';
  return (
    <div className="min-w-0 overflow-auto rounded-lg border">
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
    </div>
  );
}

export function WalkthroughExcerpt(props: ExcerptProps) {
  const [open, setOpen] = useState(false);
  const { excerpt } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DialogTrigger
          render={<Button size="sm" variant="outline" />}
          aria-description={`${excerpt.path} · ${excerpt.lines}`}
        >
          <ArrowDownRightIcon />
          See the lines
        </DialogTrigger>
        <span className="min-w-0 font-mono text-caption text-muted-foreground wrap-anywhere">
          {excerpt.path} · {excerpt.lines}
        </span>
      </div>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-auto sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="min-w-0">
          <DialogClose
            render={
              <Button size="sm" variant="ghost" className="-ml-2 self-start" />
            }
          >
            <ArrowLeftIcon />
            Back to step
          </DialogClose>
          <DialogTitle>Captured diff</DialogTitle>
          <DialogDescription>
            <span className="font-mono break-all">
              {excerpt.path} · {excerpt.lines}
            </span>
          </DialogDescription>
          {excerpt.caption && (
            <p className="text-prose">
              <RichText text={excerpt.caption} />
            </p>
          )}
        </DialogHeader>
        {open && <CapturedLines {...props} />}
      </DialogContent>
    </Dialog>
  );
}
