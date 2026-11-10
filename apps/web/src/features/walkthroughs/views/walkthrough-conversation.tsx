import { useState, type ReactNode } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ArrowUpIcon } from 'lucide-react';
import {
  answerTo,
  conversationsAt,
  savedMessageCount,
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
import {
  earlierConversations,
  postControls,
  type Conversation,
  type DeveloperMessage,
  type AgentMessage,
} from '../rules/conversations';
import { RichText } from './rich-text';

type Props = { owner: ConversationScope };

function PostActions({
  owner,
  message,
  number,
}: Props & { message?: DeveloperMessage; number: number | undefined }) {
  const { notice, waiting, copy, save, post } = usePostActions(owner, message);
  const state = message ? postControls(message) : 'available';
  const action = number === undefined ? copy : post;
  const label =
    number === undefined ? 'Copy together' : `Post together on #${number}`;
  const singleLabel =
    number === undefined ? 'Copy as prompt' : `Post on #${number}`;
  return (
    <div className="flex flex-col gap-2">
      {state === 'posted' && message?.post.status === 'posted' ? (
        <a
          className="text-caption text-muted-foreground hover:underline"
          href={message.post.url}
          target="_blank"
          rel="noreferrer"
        >
          Posted on #{number}
        </a>
      ) : null}
      {state === 'saved' && (
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          Saved for later
          <Button
            variant="link"
            size="sm"
            disabled={waiting}
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

            disabled={waiting}
            onClick={action}
          >
            {message ? singleLabel : label}
          </Button>
          {message && (
            <Button
              variant="link"
              size="sm"
              disabled={waiting}
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
  const { failure, waiting, retry } = useRetryAnswer(owner, message.replyTo);
  const state = message.state;
  return (
    <Message>
      <MessageContent>
        <MessageHeader>Walkthrough agent</MessageHeader>
        <Bubble variant="ghost" className="max-w-full">
          <BubbleContent className="whitespace-pre-wrap">
            {state.status === 'answered' ? (
              <span className={open ? undefined : 'line-clamp-3'}>
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
          {state.status === 'answered' && !open && (
            <Button variant="link" size="sm" onClick={() => setOpen(true)}>
              Read all
            </Button>
          )}
          {state.status === 'failed' && (
            <Button
              variant="link"
              size="sm"
              disabled={waiting}
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
  return conversation.messages
    .filter(
      (message): message is DeveloperMessage => message.author === 'developer',
    )
    .map((message) => {
      const reply = answerTo(conversation, message.id);
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
  runId,
  anchor,
  placeholder,
}: Props & {
  runId: string;
  anchor: Conversation['anchor'];
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const { failure, waiting, send: submit } = useSendMessage(owner);
  const send = () => {
    const text = draft.trim();
    if (!text || waiting) return;
    submit({ runId, anchor, text }, () =>
      setDraft((current) => (current === draft ? '' : current)),
    );
  };
  return (
    <>
      <InputGroup>
        <InputGroupTextarea
          value={draft}
          rows={1}
          maxLength={8000}
          aria-label={placeholder}
          placeholder={placeholder}
          className="min-h-9"
          onChange={(event) => setDraft(event.target.value)}
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
          <Tooltip>
            <TooltipTrigger
              render={
                <InputGroupButton
                  size="icon-xs"
                  variant="default"
                  aria-label="Send"
                  disabled={!draft.trim() || waiting}

                  onClick={() => send()}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              }
            />
            <TooltipContent>Send</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {failure && (
        <p role="alert" className="text-caption text-destructive">
          {failure}
        </p>
      )}
    </>
  );
}

export function WalkthroughConversation({
  owner,
  title,
  runId,
  call,
}: Props & { title: string; runId: string; call: boolean }) {
  const { view, failed, refresh } = useConversations(owner);
  const [asking, setAsking] = useState(false);
  const conversations = view
    ? conversationsAt(view, { kind: 'stop', title })
    : [];
  const visible =
    call || asking || conversations.some((item) => item.messages.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {!call && (
        <Button
          variant="link"
          size="sm"
          className="self-start"
          onClick={() => setAsking(!asking)}
        >
          Ask about this
        </Button>
      )}
      {failed && (
        <p role="alert" className="text-caption">
          Comments could not be read.{' '}
          <Button variant="link" size="sm" onClick={refresh}>
            Try again
          </Button>
        </p>
      )}
      {visible && (
        <>
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
          <Composer
            owner={owner}
            runId={runId}
            anchor={{ kind: 'stop', title }}
            placeholder={
              call ? 'Decide, or ask about this' : 'Ask about this step'
            }
          />
        </>
      )}
    </div>
  );
}

export function EarlierComments({
  owner,
  titles,
}: Props & { titles: readonly string[] }) {
  const { view } = useConversations(owner);
  const conversations = view ? earlierConversations(view, titles) : [];
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
  const count = view ? savedMessageCount(view) : 0;
  if (!count) return null;
  return (
    <div className="sticky bottom-4 z-30 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border bg-popover py-1.5 pr-1.5 pl-4 text-ui shadow-sm">
        <span>
          {count === 1 ? '1 comment saved' : `${count} comments saved`}
        </span>
        <PostActions owner={owner} number={view?.pullRequestNumber} />
      </div>
    </div>
  );
}
