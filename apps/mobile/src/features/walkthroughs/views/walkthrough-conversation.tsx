import { useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import { useAtom } from '@effect/atom-react';
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
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Loading } from '../../../components/ui/loading';
import { Message } from '../../../components/ui/message';
import { MessageComposer } from '../../../components/ui/message-composer';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import {
  useAnswerRetry,
  useAsk,
  usePostActions,
} from '../commands/conversations';
import {
  useConversations,
  type ConversationOwner,
} from '../queries/conversations';
import { walkthroughAsking, walkthroughDraft } from '../store';

type Props = { owner: ConversationOwner };

const ANSWER_LINES = 3;

function LinkButton({
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      variant="plain"
      size="sm"
      align="start"
      className="-ml-3.5 self-start"
      disabled={disabled}
      onPress={onPress}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    />
  );
}

function PostActions({
  owner,
  message,
  pullRequest,
}: Props & {
  message?: DeveloperMessage | undefined;
  pullRequest: number | undefined;
}) {
  const actions = usePostActions(owner, message);
  const { notice, waiting, copy, save, post } = actions;
  const state = postControls(message);
  const labels = postLabels(pullRequest);
  return (
    <Box gap={1}>
      {message?.post.status === 'posted' ? (
        <LinkButton
          label={postedCommentLabel(message.post.url)}
          onPress={() => {
            if (message.post.status === 'posted')
              void Linking.openURL(message.post.url);
          }}
        />
      ) : null}
      {state === 'saved' ? (
        <Box className="flex-row items-center" gap={2}>
          <Text variant="secondary" tone="muted">
            Saved for later
          </Text>
          <Button
            label="Undo"
            variant="plain"
            size="sm"
            disabled={waiting}
            onPress={() => save(false)}
          />
        </Box>
      ) : null}
      {state === 'available' ? (
        <Box className="flex-row flex-wrap items-center" gap={2}>
          <Button
            label={message ? labels.single : labels.together}
            variant={message ? 'tonal' : 'filled'}
            size="sm"
            pending={waiting}
            onPress={pullRequest === undefined ? copy : post}
          />
          {message ? (
            <Button
              label="Save for later"
              variant="plain"
              size="sm"
              disabled={waiting}
              onPress={() => save(true)}
            />
          ) : null}
        </Box>
      ) : null}
      {notice ? (
        <Box className="flex-row flex-wrap items-center" gap={2}>
          <Text
            variant="caption"
            tone="muted"
            accessibilityRole="alert"
            numberOfLines={2}
          >
            {notice.text}
          </Text>
          {notice.copy ? (
            <Button
              label="Copy"
              variant="plain"
              size="sm"
              disabled={waiting}
              onPress={copy}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function AgentReply({
  owner,
  message,
  children,
}: Props & { message: AgentMessage; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const { failure, waiting, retry } = useAnswerRetry(owner);
  const state = message.state;
  return (
    <Message author="Walkthrough agent">
      {state.status === 'answering' ? (
        <Box className="items-start">
          <Loading label="Working…" />
        </Box>
      ) : null}
      {state.status === 'answered' ? (
        <RichText
          text={state.text}
          lines={open ? undefined : ANSWER_LINES}
          onClipped={setClipped}
        />
      ) : null}
      {state.status === 'failed' ? (
        <Text accessibilityRole="alert">{state.failure.message}</Text>
      ) : null}
      {state.status === 'answered' && !open && clipped ? (
        <LinkButton label="Read all" onPress={() => setOpen(true)} />
      ) : null}
      {state.status === 'failed' ? (
        <LinkButton
          label="Try again"
          disabled={waiting}
          onPress={() => retry(message.replyTo)}
        />
      ) : null}
      {failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      {children}
    </Message>
  );
}

function Messages({
  owner,
  conversation,
  number,
}: Props & { conversation: Conversation; number: number | undefined }) {
  return developerTurns(conversation).map(({ message, reply }) => (
    <Box key={message.id} gap={3}>
      <Message align="end">
        <RichText text={message.text} />
      </Message>
      {reply ? (
        <AgentReply owner={owner} message={reply}>
          <PostActions owner={owner} message={message} pullRequest={number} />
        </AgentReply>
      ) : (
        <Box className="items-end">
          <PostActions owner={owner} message={message} pullRequest={number} />
        </Box>
      )}
    </Box>
  ));
}

function Composer({
  owner,
  title,
  placeholder,
}: Props & { title: string; placeholder: string }) {
  const [draft, setDraft] = useAtom(
    walkthroughDraft(JSON.stringify([owner.workspace.key, title])),
  );
  const { failure, waiting, ask } = useAsk(owner, title);
  return (
    <MessageComposer
      value={draft}
      placeholder={placeholder}
      sending={waiting}
      error={failure}
      onChangeText={setDraft}
      onSend={() => {
        const text = draft.trim();
        if (text && !waiting)
          ask(text, () =>
            setDraft((current) => (current === draft ? '' : current)),
          );
      }}
    />
  );
}

export function WalkthroughConversation({
  owner,
  title,
  placement,
}: Props & { title: string; placement: 'call' | 'step' }) {
  const call = placement === 'call';
  const { view, failed, refresh } = useConversations(owner);
  const [asking, setAsking] = useAtom(
    walkthroughAsking(JSON.stringify([owner.workspace.key, title])),
  );
  const conversations = stopConversations(view, title);
  const asked = conversations.some((item) => item.messages.length > 0);
  return (
    <Box gap={3}>
      {call ? null : (
        <LinkButton label="Ask about this" onPress={() => setAsking(!asking)} />
      )}
      {failed ? (
        <Box className="flex-row flex-wrap items-center" gap={2}>
          <Text variant="caption" tone="muted" accessibilityRole="alert">
            Comments could not be read.
          </Text>
          <Button
            label="Try again"
            variant="plain"
            size="sm"
            onPress={refresh}
          />
        </Box>
      ) : null}
      {call || asking || asked ? (
        <>
          {conversations.length > 0 ? (
            <Box gap={4}>
              <Separator />
              {conversations.map((conversation) => (
                <Messages
                  key={conversation.runId}
                  owner={owner}
                  conversation={conversation}
                  number={view?.pullRequestNumber}
                />
              ))}
            </Box>
          ) : null}
          <Composer
            owner={owner}
            title={title}
            placeholder={
              call ? 'Decide, or ask about this' : 'Ask about this step'
            }
          />
        </>
      ) : null}
    </Box>
  );
}

export function EarlierComments({
  owner,
  titles,
}: Props & { titles: readonly string[] }) {
  const { view } = useConversations(owner);
  const earlier = earlierConversations(view, titles);
  if (!earlier.length) return null;
  return (
    <Box gap={3}>
      <Separator />
      <Text variant="secondary" weight="semibold" accessibilityRole="header">
        Earlier comments
      </Text>
      {earlier.map((conversation, index) => (
        <Messages
          key={`${conversation.runId}:${index}`}
          owner={owner}
          conversation={conversation}
          number={view?.pullRequestNumber}
        />
      ))}
    </Box>
  );
}

export function useSavedSummary(owner: ConversationOwner) {
  return savedSummary(useConversations(owner).view);
}

export function PostSaved({ owner }: Props) {
  const { view } = useConversations(owner);
  const saved = savedSummary(view);
  if (!saved) return null;
  return (
    <Box
      className="absolute inset-x-0 bottom-4 items-center px-4"
      pointerEvents="box-none"
    >
      <Box
        className="max-w-full flex-row flex-wrap items-center justify-center rounded-3xl border border-border bg-popover py-1.5 pr-1.5 pl-4 shadow-sm"
        gap={3}
      >
        <Text variant="secondary">{saved}</Text>
        <PostActions owner={owner} pullRequest={view?.pullRequestNumber} />
      </Box>
    </Box>
  );
}
