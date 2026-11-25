import type { WalkthroughDraftPlacement } from '@porcelain/client/walkthroughs';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { useState, type ReactNode } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ArrowUpIcon } from 'lucide-react';
import {
  developerTurns,
  earlierConversations,
  postControls,
  postedCommentLabel,
  postLabels,
  savedSummary,
  stopConversations,
  type AgentMessage,
  type Conversation,
  type DeveloperMessage,
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
  usePostActions,
  useRetryAnswer,
  useSendMessage,
} from '../commands/conversations';
import {
  useConversations,
  type ConversationScope,
} from '../queries/conversations';
import { RichText } from './rich-text';
import { commentsAt } from '@porcelain/client/comments/rules';
import {
  DraftCard,
  useCommentCommands,
  useComments,
} from '@/features/comments/index';

type Props = { owner: ConversationScope };

function PostActions({
  owner,
  message,
  number,
}: Props & { message?: DeveloperMessage; number: number | undefined }) {
  const { notice, waiting, copy, save, post } = usePostActions(owner, message);
  const state = postControls(message);
  const action = number === undefined ? copy : post;
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const postBlock = number === undefined ? undefined : writeBlock;
  const labels = postLabels(number);
  return (
    <div className="flex flex-col gap-2">
      {state === 'posted' && message?.post.status === 'posted' ? (
        <a
          className="text-caption text-muted-foreground hover:underline"
          href={message.post.url}
          target="_blank"
          rel="noreferrer"
        >
          {postedCommentLabel(message.post.url)}
        </a>
      ) : null}
      {state === 'saved' && (
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          Saved for later
          <Button
            variant="link"
            size="sm"
            disabled={waiting || Boolean(writeBlock)}
            aria-description={writeBlock}
            onClick={() => save(false)}
          >
            Undo
          </Button>
        </span>
      )}
      {state === 'available' && (
        <span className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant={message ? 'outline' : 'default'}

            disabled={waiting || Boolean(postBlock)}
            aria-description={postBlock}
            onClick={action}
          >
            {message ? labels.single : labels.together}
          </Button>
          {message && (
            <Button
              variant="link"
              size="sm"
              disabled={waiting || Boolean(writeBlock)}
              aria-description={writeBlock}
              onClick={() => save(true)}
            >
              Save for later
            </Button>
          )}
        </span>
      )}
      {notice && (
        <div role="status" className="text-caption text-muted-foreground">
          {notice.text}
          {notice.copy && (
            <Button
              variant="link"
              size="sm"
              disabled={waiting}
              onClick={() => copy()}
            >
              Copy
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AgentReply({
  message,
  children,
  owner,
}: Props & { message: AgentMessage; children: ReactNode }) {
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
          {children}
        </div>
        {failure && <p role="alert">{failure}</p>}
      </MessageContent>
    </Message>
  );
}

function Messages({
  conversation,
  owner,
  number,
}: Props & { conversation: Conversation; number: number | undefined }) {
  return developerTurns(conversation).map(({ message, reply }) => {
    const controls = (
      <PostActions owner={owner} message={message} number={number} />
    );
    return (
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
        {reply ? (
          <AgentReply owner={owner} message={reply}>
            {controls}
          </AgentReply>
        ) : (
          <div className="flex justify-end">{controls}</div>
        )}
      </div>
    );
  });
}

function Composer({
  owner,
  title,
  placement,
  placeholder,
  onComment,
}: Props & {
  title: string;
  placement: WalkthroughDraftPlacement;
  placeholder: string;
  onComment?: ((text: string) => Promise<unknown>) | undefined;
}) {
  const [commenting, setCommenting] = useState(false);
  const [commentFailure, setCommentFailure] = useState<string>();
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const {
    text,
    failure,
    waiting,
    change,
    send: submit,
  } = useSendMessage(owner, title, placement);
  const send = () => {
    if (!writeBlock) submit();
  };
  const comment = () => {
    const trimmed = text.trim();
    if (!onComment || !trimmed || writeBlock || commenting) return;
    setCommenting(true);
    setCommentFailure(undefined);
    onComment(trimmed).then(
      () => {
        setCommenting(false);
        change('');
      },
      () => {
        setCommenting(false);
        setCommentFailure('The comment was not saved. Try again.');
      },
    );
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
  call,
  stepTitle,
}: Props & { title: string; call: boolean; stepTitle?: string }) {
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
                number={view?.pullRequestNumber}
              />
            ))}
          </MessageGroup>
        </div>
      )}
      {stepTitle !== undefined && (
        <StepDrafts owner={owner} title={stepTitle} />
      )}
      <Composer
        owner={owner}
        title={title}
        placement={call ? 'call' : 'step'}
        placeholder={
          stepTitle !== undefined
            ? 'Comment on this step, or ask the agent'
            : call
              ? 'Decide, or ask about this'
              : 'Ask about this step'
        }
        onComment={
          stepTitle === undefined
            ? undefined
            : (text) =>
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
            number={view?.pullRequestNumber}
          />
        ))}
      </MessageGroup>
    </section>
  );
}

export function PostSaved({ owner }: Props) {
  const { view } = useConversations(owner);
  const saved = savedSummary(view);
  if (!saved) return null;
  return (
    <div className="sticky bottom-4 z-30 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border bg-popover py-1.5 pr-1.5 pl-4 text-ui shadow-sm">
        <span>{saved}</span>
        <PostActions owner={owner} number={view?.pullRequestNumber} />
      </div>
    </div>
  );
}
