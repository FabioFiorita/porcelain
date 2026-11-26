import { useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import {
  anchorLabel,
  draftCountLabel,
  generalReviewNote,
  inlineReviewLocation,
  openComments,
  postedComments,
  reviewForm,
} from '@porcelain/client/comments/rules';
import { reviewFormBinding } from '@porcelain/client/comments';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Separator } from '../../../components/ui/separator';
import { Sheet } from '../../../components/ui/sheet';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { useWritesBlocked } from '../../access';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import {
  useCopyComments,
  usePostReview,
  useReviewPreview,
  type ReviewPreview,
} from '../commands/comments';
import { useComments } from '../queries/comments';
import { CommentForm } from './comment-sheet';
import { DraftComments } from './draft-comments';

export function PublishCommentsSheet({
  workspace,
}: {
  workspace: string | undefined;
}) {
  return (
    <Sheet title="Publish">
      <WorkspaceGate
        frame="pane"
        expectedWorkspace={workspace ?? ''}
        changed={<Empty title="Another worktree is selected now." />}
      >
        {(selected) => <Publish workspace={selected} />}
      </WorkspaceGate>
    </Sheet>
  );
}

function Publish({ workspace }: { workspace: Workspace }) {
  const [preview, setPreview] = useState<ReviewPreview>();
  const [posted, setPosted] = useState<string>();
  if (posted) return <Posted url={posted} />;
  if (preview)
    return (
      <ReviewStep
        workspace={workspace}
        preview={preview}
        onBack={() => setPreview(undefined)}
        onPosted={setPosted}
      />
    );
  return <Drafts workspace={workspace} onReview={setPreview} />;
}

function Posted({ url }: { url: string }) {
  const link = usePreviewLink();
  return (
    <>
      <Text weight="semibold" accessibilityRole="header">
        Review posted
      </Text>
      <Text tone="muted">The comments are marked as posted.</Text>
      <Button
        label="Open on GitHub"
        variant="tonal"
        onPress={() => link.open(url)}
      />
      {link.error ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {link.error}
        </Text>
      ) : null}
    </>
  );
}

function Way({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <Box gap={2} padding={4}>
      <Text weight="medium">{title}</Text>
      <Text variant="secondary" tone="muted">
        {detail}
      </Text>
      {action}
    </Box>
  );
}

function Drafts({
  workspace,
  onReview,
}: {
  workspace: Workspace;
  onReview: (preview: ReviewPreview) => void;
}) {
  const { view, failed, waiting, refresh } = useComments(workspace);
  const review = useReviewPreview(workspace);
  const copy = useCopyComments();
  const [editing, setEditing] = useState<string>();
  if (!view)
    return failed ? (
      <ErrorState
        message="Comments could not be read."
        retry={{ label: 'Try again', onPress: refresh, pending: waiting }}
      />
    ) : (
      <Spinner />
    );
  const open = openComments(view);
  const posted = postedComments(view).length;
  return (
    <>
      <Text variant="secondary" tone="muted">
        {open.length > 0 ? `${draftCountLabel(open.length)} on ` : 'On '}
        <Text variant="mono" tone="muted">
          {view.branch || 'detached HEAD'}
        </Text>{' '}
        at{' '}
        <Text variant="mono" tone="muted">
          {view.headOid.slice(0, 7)}
        </Text>
        . Nothing is posted until you publish.
      </Text>
      {open.length === 0 ? (
        <Text tone="muted">
          No draft comments. Add one on a step, a diagram node, a file or its
          lines.
        </Text>
      ) : (
        open.map((comment) =>
          editing === comment.id ? (
            <CommentForm
              key={comment.id}
              workspace={workspace}
              anchor={comment.anchor}
              comment={comment}
              onClose={() => setEditing(undefined)}
            />
          ) : (
            <DraftComments
              key={comment.id}
              workspace={workspace}
              drafts={[comment]}
              locations={(draft) => anchorLabel(draft.anchor)}
              onEdit={(draft) => setEditing(draft.id)}
            />
          ),
        )
      )}
      {posted > 0 ? (
        <Text variant="caption" tone="muted">
          {posted === 1 ? '1 comment posted' : `${posted} comments posted`}
        </Text>
      ) : null}
      {open.length > 0 ? (
        <Card>
          <Way
            title="Post as one pull request review"
            detail={
              review.unavailable ??
              'One review, each comment on its file and line.'
            }
            action={
              <Button
                label="Preview review"
                size="sm"
                pending={review.waiting}
                onPress={() =>
                  void review.read().then((next) => {
                    if (next) onReview(next);
                  })
                }
              />
            }
          />
          <Separator />
          <Way
            title="Copy for an agent"
            detail={
              copy.failure ??
              'Markdown with each file, line range and the head commit.'
            }
            action={
              <Button
                label="Copy Markdown"
                size="sm"
                variant="tonal"
                onPress={() => copy.copy(view.markdown)}
              />
            }
          />
        </Card>
      ) : null}
    </>
  );
}

function ReviewComment({
  location,
  note,
  value,
  onChange,
}: {
  location: string;
  note: string | undefined;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <Field label={note ? `${location} · ${note}` : location}>
      <Input
        multiline
        value={value}
        accessibilityLabel={`Comment on ${location}`}
        onChangeText={onChange}
      />
    </Field>
  );
}

function ReviewStep({
  workspace,
  preview,
  onBack,
  onPosted,
}: {
  workspace: Workspace;
  preview: ReviewPreview;
  onBack: () => void;
  onPosted: (url: string) => void;
}) {
  const post = usePostReview(workspace);
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const review = reviewFormBinding(
    useState(() => reviewForm(preview)),
    preview,
  );
  return (
    <>
      <Text weight="semibold" accessibilityRole="header">
        Review on #{preview.pullRequest.number} · {preview.pullRequest.title}
      </Text>
      <Text variant="secondary" tone="muted">
        This is exactly what will be posted, as one review.
      </Text>
      <Field label="Summary">
        <Input
          multiline
          value={review.summary}
          placeholder="Optional"
          accessibilityLabel="Summary"
          onChangeText={review.setSummary}
        />
      </Field>
      {preview.inline.length > 0 ? (
        <Text variant="caption" tone="muted" accessibilityRole="header">
          On their lines · {preview.inline.length}
        </Text>
      ) : null}
      {preview.inline.map((comment) => (
        <ReviewComment
          key={comment.id}
          location={inlineReviewLocation(comment)}
          note={undefined}
          value={review.body(comment.id)}
          onChange={review.edit(comment.id)}
        />
      ))}
      {preview.general.length > 0 ? (
        <Text variant="caption" tone="muted" accessibilityRole="header">
          In the review body · {preview.general.length}
        </Text>
      ) : null}
      {preview.general.map((comment) => (
        <ReviewComment
          key={comment.id}
          location={comment.location}
          note={generalReviewNote(comment.reason)}
          value={review.body(comment.id)}
          onChange={review.edit(comment.id)}
        />
      ))}
      {post.failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {post.failure}
        </Text>
      ) : null}
      <Button
        label="Post review"
        pending={post.waiting}
        disabled={!review.request || blocked}
        onPress={() => {
          if (!review.request) return;
          Keyboard.dismiss();
          void post.run(review.request).then((answer) => {
            if (answer) onPosted(answer.url);
          });
        }}
      />
      <Button label="Back" variant="plain" onPress={onBack} />
    </>
  );
}
