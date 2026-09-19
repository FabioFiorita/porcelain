import { MessageSquarePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { anchorLabel, type CodeAnchor } from '../../domain/comments';
import { basename, type ReviewScope } from '../../domain/review';
import { useCreateComment } from '../../query/comments';
import { reportFailure } from '../workspace/notify';

type Props = {
  label: string;
  submitLabel?: string;
  placeholder?: string;
  /** While the comment is posting; the text stays put if it fails. */
  pending?: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void;
};

/** Opens in place. Text is local so typing never re-renders the diff around it. */
export function InlineComposer({
  label,
  submitLabel = 'Comment',
  placeholder = 'Add a comment…',
  pending = false,
  onCancel,
  onSubmit,
}: Props) {
  const [body, setBody] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const submit = () => {
    if (!pending && body.trim() !== '') onSubmit(body.trim());
  };

  return (
    <div className="diff-annotation rounded-xl border bg-card p-2.5 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageSquarePlus className="size-3.5" />
        <span>{label}</span>
      </div>
      <Textarea
        ref={field}
        rows={3}
        value={body}
        placeholder={placeholder}
        className="text-[12.5px]"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Keep J/K/R/C from reaching the review shortcuts while typing.
          event.stopPropagation();
          if (event.key === 'Escape') onCancel();
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
            submit();
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="mr-auto text-[10.5px] text-muted-foreground">
          ⌘↵ to {submitLabel.toLowerCase()} · Esc to cancel
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pending || body.trim() === ''}
          onClick={submit}
        >
          {pending && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Posting saves the thread at once, as the reviewer's. It owns its mutation so
 * the spinner updates without CodeView re-rendering the item around it.
 */
export function NewThreadComposer({
  scope,
  anchor,
  onClose,
}: {
  scope: ReviewScope;
  anchor: CodeAnchor;
  onClose: () => void;
}) {
  const create = useCreateComment(scope);
  return (
    <InlineComposer
      label={`${basename(anchor.filePath)} · ${anchorLabel(anchor)}`}
      pending={create.isPending}
      onCancel={onClose}
      onSubmit={(body) =>
        reportFailure(
          create.submit({ anchor, body }).then(onClose),
          'The comment was not posted',
        )
      }
    />
  );
}
