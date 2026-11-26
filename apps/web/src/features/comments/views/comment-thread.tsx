import { useState } from 'react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import type {
  CommentAnchor,
  DraftComment,
} from '@porcelain/client/comments/rules';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import {
  useCommentCommands,
  useCommentSubmission,
  useRemoveComment,
} from '../commands/comments';
import type { CommentOwner } from '../queries/comments';

const MAX_LENGTH = 8000;

function CommentComposer({
  owner,
  initial = '',
  label,
  submitLabel = 'Comment',
  onSubmit,
  onClose,
}: {
  owner: CommentOwner;
  initial?: string;
  label: string;
  submitLabel?: string;
  onSubmit: (text: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const {
    waiting,
    failure,
    submit: save,
  } = useCommentSubmission(onSubmit, onClose);
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const trimmed = text.trim();
  const submit = () => {
    if (!trimmed || waiting || writeBlock) return;
    void save(trimmed);
  };
  return (
    <div className="flex flex-col gap-2 font-sans" data-comment-composer="">
      <Textarea
        autoFocus
        value={text}
        maxLength={MAX_LENGTH}
        rows={2}
        aria-label={label}
        placeholder="Leave a comment"
        className="min-h-14"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey) &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {failure && (
          <p role="alert" className="mr-auto text-caption text-destructive">
            {failure}
          </p>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!trimmed || waiting || Boolean(writeBlock)}
          aria-description={writeBlock}
          onClick={submit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function IconAction({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof PencilIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function DraftCard({
  owner,
  comment,
  location,
}: {
  owner: CommentOwner;
  comment: DraftComment;
  location?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { failure, waiting, remove } = useRemoveComment(owner, comment.id);
  const commands = useCommentCommands(owner);
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const published = comment.publication.status === 'published';
  if (editing)
    return (
      <CommentComposer
        owner={owner}
        initial={comment.text}
        label="Edit comment"
        submitLabel="Save"
        onSubmit={(text) => commands.edit.run({ commentId: comment.id, text })}
        onClose={() => setEditing(false)}
      />
    );
  return (
    <article
      aria-label={location ? `Comment on ${location}` : 'Comment'}
      data-draft-comment={comment.id}
      className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2 font-sans"
    >
      <header className="flex min-h-6 items-center gap-2 text-caption text-muted-foreground">
        {location && (
          <TruncatedText
            className="min-w-0 font-mono text-foreground-2"
            text={location}
          />
        )}
        {published && comment.publication.status === 'published' ? (
          <a
            href={comment.publication.url}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            Posted
          </a>
        ) : (
          <span>Draft</span>
        )}
        {comment.outdated && (
          <span className="text-warn">Outdated · the lines changed</span>
        )}
        {!published && (
          <span className="ml-auto flex items-center">
            <IconAction
              label="Edit comment"
              icon={PencilIcon}
              disabled={Boolean(writeBlock)}
              onClick={() => setEditing(true)}
            />
            <IconAction
              label="Delete comment"
              icon={Trash2Icon}
              disabled={Boolean(writeBlock) || waiting}
              onClick={() => void remove()}
            />
          </span>
        )}
      </header>
      <p className="text-ui whitespace-pre-wrap text-foreground">
        {comment.text}
      </p>
      {failure && (
        <p role="alert" className="text-caption text-destructive">
          {failure}
        </p>
      )}
    </article>
  );
}

export function CommentThread({
  owner,
  drafts,
  anchor,
  composing,
  onClose,
  className,
}: {
  owner: CommentOwner;
  drafts: readonly DraftComment[];
  anchor: CommentAnchor | undefined;
  composing: boolean;
  onClose: () => void;
  className?: string;
}) {
  const commands = useCommentCommands(owner);
  if (drafts.length === 0 && !composing) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {drafts.map((comment) => (
        <DraftCard key={comment.id} owner={owner} comment={comment} />
      ))}
      {composing && anchor && (
        <CommentComposer
          owner={owner}
          label="New comment"
          onSubmit={(text) => commands.add.run({ anchor, text })}
          onClose={onClose}
        />
      )}
    </div>
  );
}
