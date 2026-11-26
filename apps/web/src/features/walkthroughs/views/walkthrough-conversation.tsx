import { useCommentSubmission } from '@/features/comments/index';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { useState } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ArrowUpIcon } from 'lucide-react';
import {
  developerTurns,
  earlierConversations,
  stopConversations,
  type AgentMessage,
  type Conversation,
} from '@porcelain/client/walkthroughs/rules';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from '@/components/ui/message';
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';
import {
  useAddToReview,
  useRetryAnswer,
  useSendMessage,
} from '../commands/conversations';
import {
  useConversations,
  type ConversationScope,
} from '../queries/conversations';
import { RichText } from './rich-text';
import { commentsAt, quotedAnswer } from '@porcelain/client/comments/rules';
import {
  DraftCard,
  useCommentCommands,
  useComments,
} from '@/features/comments/index';

type Props = { owner: ConversationScope };

function AgentReply({
  message,
  question,
  stepTitle,
  owner,
}: Props & {
  message: AgentMessage;
  question: string;
  stepTitle: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [attach] = useState(() => (element: HTMLSpanElement | null) => {
    if (!element) return;
    const measure = () =>
      setClipped(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
  const { failure, waiting, retry } = useRetryAnswer(owner, message.replyTo);
  const state = message.state;
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  return (
    <Message>
      <MessageContent>
        <MessageHeader>Walkthrough agent</MessageHeader>
        <Bubble variant="ghost" className="max-w-full">
          <BubbleContent className="whitespace-pre-wrap">
            {state.status === 'answered' ? (
              <span ref={attach} className={open ? undefined : 'line-clamp-3'}>
                <RichText text={state.text} />
              </span>
            ) : null}
            {state.status === 'answering' && (
              <span role="status" className="text-muted-foreground">
                Working…
              </span>
            )}
            {state.status === 'failed' && <span>{state.failure.message}</span>}
          </BubbleContent>
        </Bubble>
        <div className="flex flex-wrap items-center gap-3">
          {state.status === 'answered' && !open && clipped && (
            <Button variant="link" size="sm" onClick={() => setOpen(true)}>
              Read all
            </Button>
          )}
          {state.status === 'failed' && (
            <Button
              variant="link"
              size="sm"
              disabled={waiting || Boolean(writeBlock)}
              aria-description={writeBlock}
              onClick={() => retry()}
            >
              Try again
            </Button>
          )}
          {state.status === 'answered' && stepTitle !== undefined && (
            <AddToReview
              owner={owner}
              stepTitle={stepTitle}
              text={quotedAnswer(question, state.text)}
            />
          )}
        </div>
        {failure && (
          <p role="alert" className="text-caption text-destructive">
            {failure}
          </p>
        )}
      </MessageContent>
    </Message>
  );
}

function AddToReview({
  owner,
  stepTitle,
  text,
}: Props & { stepTitle: string; text: string }) {
  const review = useAddToReview(owner, stepTitle);
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  if (review.added)
    return (
      <span role="status" className="text-caption text-muted-foreground">
        Added to the review
      </span>
    );
  return (
    <>
      <Button
        variant="link"
        size="sm"
        disabled={review.waiting || Boolean(writeBlock)}
        aria-description={writeBlock}
        onClick={() => review.add(text)}
      >
        Add to review
      </Button>
      {review.failure && (
        <span role="alert" className="text-caption text-destructive">
          {review.failure}
        </span>
      )}
    </>
  );
}

function Messages({
  conversation,
  owner,
  stepTitle,
}: Props & { conversation: Conversation; stepTitle: string | undefined }) {
  return developerTurns(conversation).map(({ message, reply }) => (
    <div key={message.id} className="flex flex-col gap-3">
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="secondary">
            <BubbleContent className="whitespace-pre-wrap">
              <RichText text={message.text} />
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      {reply && (
        <AgentReply
          owner={owner}
          message={reply}
          question={message.text}
          stepTitle={stepTitle}
        />
      )}
    </div>
  ));
}

function Composer({
  owner,
  title,
  placeholder,
  onComment,
}: Props & {
  title: string;
  placeholder: string;
  onComment?: ((text: string) => Promise<unknown>) | undefined;
}) {
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const {
    text,
    failure,
    waiting,
    change,
    send: submit,
  } = useSendMessage(owner, title);
  const send = () => {
    if (!writeBlock) submit();
  };
  const {
    waiting: commenting,
    failure: commentFailure,
    submit: saveComment,
  } = useCommentSubmission(onComment, () => change(''));
  const comment = () => {
    const trimmed = text.trim();
    if (trimmed && !writeBlock) void saveComment(trimmed);
  };
  return (
    <>
      <InputGroup>
        <InputGroupTextarea
          value={text}
          rows={1}
          maxLength={8000}
          aria-label={placeholder}
          placeholder={placeholder}
          className="min-h-9"
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {onComment && (
            <InputGroupButton
              size="xs"
              variant="outline"
              focusableWhenDisabled
              disabled={!text.trim() || commenting || Boolean(writeBlock)}
              aria-description={writeBlock}
              onClick={comment}
            >
              Comment
            </InputGroupButton>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <InputGroupButton
                  size={onComment ? 'xs' : 'icon-xs'}
                  variant="default"
                  aria-label={onComment ? 'Ask' : 'Send'}
                  focusableWhenDisabled
                  disabled={!text.trim() || waiting || Boolean(writeBlock)}
                  aria-description={writeBlock}

                  onClick={send}
                >
                  {onComment && 'Ask'}
                  <ArrowUpIcon />
                </InputGroupButton>
              }
            />
            <TooltipContent>
              {onComment ? 'Ask the Walkthrough agent' : 'Send'}
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {(failure ?? commentFailure) && (
        <p role="alert" className="text-caption text-destructive">
          {failure ?? commentFailure}
        </p>
      )}
    </>
  );
}

function StepDrafts({ owner, title }: Props & { title: string }) {
  const commentOwner = { scope: owner.scope, context: owner.context };
  const { view } = useComments(commentOwner);
  const drafts = commentsAt(
    view,
    (anchor) => anchor.kind === 'step' && anchor.title === title,
  );
  if (drafts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {drafts.map((comment) => (
        <DraftCard key={comment.id} owner={commentOwner} comment={comment} />
      ))}
    </div>
  );
}

export function WalkthroughConversation({
  owner,
  title,
  stepTitle,
}: Props & { title: string; stepTitle: string }) {
  const { view, failed, refresh } = useConversations(owner);
  const comments = useCommentCommands({
    scope: owner.scope,
    context: owner.context,
  });
  const conversations = stopConversations(view, title);
  return (
    <div className="flex flex-col gap-3">
      {failed && (
        <p role="alert" className="text-caption">
          Comments could not be read.{' '}
          <Button variant="link" size="sm" onClick={refresh}>
            Try again
          </Button>
        </p>
      )}
      {conversations.length > 0 && (
        <div className="border-t pt-3">
          <MessageGroup>
            {conversations.map((conversation) => (
              <Messages
                key={conversation.runId}
                owner={owner}
                conversation={conversation}
                stepTitle={stepTitle}
              />
            ))}
          </MessageGroup>
        </div>
      )}
      <StepDrafts owner={owner} title={stepTitle} />
      <Composer
        owner={owner}
        title={title}
        placeholder="Comment on this step, or ask the agent"
        onComment={(text) =>
          comments.add.run({
            anchor: { kind: 'step', title: stepTitle },
            text,
          })
        }
      />
    </div>
  );
}

export function EarlierComments({
  owner,
  titles,
}: Props & { titles: readonly string[] }) {
  const { view } = useConversations(owner);
  const conversations = earlierConversations(view, titles);
  if (conversations.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <h2 className="text-ui font-semibold">Earlier comments</h2>
      <MessageGroup>
        {conversations.map((conversation, index) => (
          <Messages
            key={`${conversation.runId}:${index}`}
            owner={owner}
            conversation={conversation}
            stepTitle={undefined}
          />
        ))}
      </MessageGroup>
    </section>
  );
}
