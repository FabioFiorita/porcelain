import { useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import { anchorLabel, openComments } from '@porcelain/client/comments/rules';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PendingSpinner } from '@/shared/views/state-notice';
import { copyText } from '@/shared/workspace/copy';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import { cn } from '@/shared/lib/utils';
import {
  usePostReview,
  useReviewPreview,
  type ReviewPreview,
} from '../commands/comments';
import { useComments, type CommentOwner } from '../queries/comments';
import { DraftCard } from './comment-thread';

const COMMAND = 'porcelain comments';

type Step = 'list' | 'publish' | 'review';

function OutputRow({
  title,
  detail,
  action,
}: {
  title: string;
  detail: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 border-t px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ui font-medium">{title}</span>
        <span className="text-caption text-muted-foreground">{detail}</span>
      </div>
      <span className="shrink-0">{action}</span>
    </li>
  );
}

function ReviewComment({
  location,
  code = true,
  note,
  value,
  onChange,
}: {
  location: string;
  code?: boolean;
  note?: string | undefined;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2 text-caption">
        <TruncatedText
          className={cn('min-w-0 text-foreground-2', code && 'font-mono')}
          text={location}
        />
        {note && <span className="shrink-0 text-muted-foreground">{note}</span>}
      </span>
      <Textarea
        value={value}
        aria-label={`Comment on ${location}`}
        className="min-h-10"
        onChange={(event) => onChange(event.target.value)}
      />
    </li>
  );
}

const BODY_REASON: Record<
  ReviewPreview['general'][number]['reason'],
  string | undefined
> = {
  'not-in-pull-request': 'not in the pull request diff',
  outdated: 'outdated',
  file: 'whole file',
  step: undefined,
  node: undefined,
};

function ReviewStep({
  owner,
  preview,
  onBack,
  onPosted,
}: {
  owner: CommentOwner;
  preview: ReviewPreview;
  onBack: () => void;
  onPosted: (url: string) => void;
}) {
  const { failure, waiting, post } = usePostReview(owner, onPosted);
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const [summary, setSummary] = useState('');
  const [bodies, setBodies] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...preview.inline, ...preview.general].map((comment) => [
        comment.id,
        comment.body,
      ]),
    ),
  );
  const edit = (id: string) => (text: string) =>
    setBodies((current) => ({ ...current, [id]: text }));
  const empty = Object.values(bodies).some((text) => !text.trim());
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Review on #{preview.pullRequest.number} · {preview.pullRequest.title}
        </DialogTitle>
        <DialogDescription>
          This is exactly what will be posted, as one review.
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-1 flex max-h-[60vh] flex-col gap-4 overflow-auto px-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted-foreground">Summary</span>
          <Textarea
            value={summary}
            placeholder="Optional"
            className="min-h-10"
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>
        {preview.inline.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-caption font-medium text-muted-foreground">
              On their lines · {preview.inline.length}
            </h3>
            <ul className="flex flex-col gap-3">
              {preview.inline.map((comment) => (
                <ReviewComment
                  key={comment.id}
                  location={`${comment.path}:${comment.startLine ? `${comment.startLine}-` : ''}${comment.line}${comment.side === 'LEFT' ? ' (removed)' : ''}`}
                  value={bodies[comment.id] ?? ''}
                  onChange={edit(comment.id)}
                />
              ))}
            </ul>
          </section>
        )}
        {preview.general.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-caption font-medium text-muted-foreground">
              In the review body · {preview.general.length}
            </h3>
            <ul className="flex flex-col gap-3">
              {preview.general.map((comment) => (
                <ReviewComment
                  key={comment.id}
                  location={comment.location}
                  code={comment.reason !== 'step' && comment.reason !== 'node'}
                  note={BODY_REASON[comment.reason]}
                  value={bodies[comment.id] ?? ''}
                  onChange={edit(comment.id)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
      <DialogFooter>
        {failure && (
          <p role="alert" className="mr-auto text-caption text-destructive">
            {failure}
          </p>
        )}
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button
          disabled={empty || waiting || Boolean(writeBlock)}
          aria-description={writeBlock}
          onClick={() =>
            void post({
              headOid: preview.headOid,
              summary,
              bodies: Object.fromEntries(
                Object.entries(bodies).map(([id, text]) => [id, text.trim()]),
              ),
            })
          }
        >
          Post review
        </Button>
      </DialogFooter>
    </>
  );
}

function PublishStep({
  owner,
  count,
  markdown,
  onBack,
  onReview,
}: {
  owner: CommentOwner;
  count: number;
  markdown: string;
  onBack: () => void;
  onReview: (preview: ReviewPreview) => void;
}) {
  const { unavailable, waiting, read } = useReviewPreview(owner, onReview);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Publish {count === 1 ? '1 comment' : `${count} comments`}
        </DialogTitle>
      </DialogHeader>
      <ul className="flex flex-col rounded-lg border">
        <OutputRow
          title="Review on the pull request"
          detail={
            unavailable ?? 'One review, each comment on its file and line.'
          }
          action={
            <Button size="sm" disabled={waiting} onClick={() => void read()}>
              Preview review
            </Button>
          }
        />
        <OutputRow
          title="Copy for an agent"
          detail="Markdown with each file, line range and the head commit."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText(markdown, 'comments')}
            >
              Copy Markdown
            </Button>
          }
        />
        <OutputRow
          title="From the CLI"
          detail={
            <>
              Run <code className="font-mono text-foreground">{COMMAND}</code>{' '}
              in this worktree. Add{' '}
              <code className="font-mono text-foreground">--json</code> for
              JSON.
            </>
          }
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText(COMMAND, 'the command')}
            >
              Copy command
            </Button>
          }
        />
      </ul>
      <DialogFooter>
        <Button variant="ghost" className="mr-auto" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Comments
        </Button>
      </DialogFooter>
    </>
  );
}

function ListStep({
  owner,
  onPublish,
}: {
  owner: CommentOwner;
  onPublish: () => void;
}) {
  const { view, failed, refresh } = useComments(owner);
  const open = openComments(view);
  const posted = (view?.comments ?? []).filter(
    (comment) => comment.publication.status === 'published',
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Comments{open.length > 0 ? ` · ${open.length}` : ''}
        </DialogTitle>
        {view && (
          <DialogDescription>
            <span className="font-mono">{view.branch || 'detached HEAD'}</span>{' '}
            at <span className="font-mono">{view.headOid.slice(0, 7)}</span>.
            Nothing is posted until you publish.
          </DialogDescription>
        )}
      </DialogHeader>
      <div className="-mx-1 flex max-h-[60vh] flex-col gap-2 overflow-auto px-1">
        {!view && !failed && <PendingSpinner label="Loading comments" />}
        {failed && (
          <p role="alert" className="text-ui">
            Comments could not be read.{' '}
            <Button variant="link" size="sm" onClick={refresh}>
              Try again
            </Button>
          </p>
        )}
        {view && open.length === 0 && (
          <p className="text-ui text-muted-foreground">
            No draft comments. Add one from any diff line, file, step or diagram
            node.
          </p>
        )}
        {open.map((comment) => (
          <DraftCard
            key={comment.id}
            owner={owner}
            comment={comment}
            location={anchorLabel(comment.anchor)}
          />
        ))}
        {posted.length > 0 && (
          <details className="mt-2 text-ui">
            <summary className="cursor-default text-caption text-muted-foreground">
              Posted · {posted.length}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {posted.map((comment) => (
                <DraftCard
                  key={comment.id}
                  owner={owner}
                  comment={comment}
                  location={anchorLabel(comment.anchor)}
                />
              ))}
            </div>
          </details>
        )}
      </div>
      <DialogFooter>
        <Button disabled={open.length === 0} onClick={onPublish}>
          Publish…
        </Button>
      </DialogFooter>
    </>
  );
}

export function CommentsDialog({
  owner,
  open,
  onOpenChange,
  initialStep = 'list',
}: {
  owner: CommentOwner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: Exclude<Step, 'review'>;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [preview, setPreview] = useState<ReviewPreview>();
  const [posted, setPosted] = useState<string>();
  const { view } = useComments(owner);
  const count = openComments(view).length;
  const content = () => {
    if (posted)
      return (
        <>
          <DialogHeader>
            <DialogTitle>Review posted</DialogTitle>
            <DialogDescription>
              The comments are marked as posted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              render={<a href={posted} target="_blank" rel="noreferrer" />}
            >
              Open on GitHub
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </DialogFooter>
        </>
      );
    if (step === 'review' && preview)
      return (
        <ReviewStep
          owner={owner}
          preview={preview}
          onBack={() => setStep('publish')}
          onPosted={setPosted}
        />
      );
    if (step === 'publish')
      return (
        <PublishStep
          owner={owner}
          count={count}
          markdown={view?.markdown ?? ''}
          onBack={() => setStep('list')}
          onReview={(next) => {
            setPreview(next);
            setStep('review');
          }}
        />
      );
    return <ListStep owner={owner} onPublish={() => setStep('publish')} />;
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setStep(initialStep);
          setPosted(undefined);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[min(92vw,40rem)]">
        {content()}
      </DialogContent>
    </Dialog>
  );
}
