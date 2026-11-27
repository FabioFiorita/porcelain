import { useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { useAtom } from '@effect/atom-react';
import { quotedAnswer } from '@porcelain/client/comments/rules';
import {
  developerTurns,
  earlierConversations,
  stopConversations,
  type AgentMessage,
  type Conversation,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { Message } from '../../../components/ui/message';
import type { KeyboardScroller } from '../../../components/ui/keyboard-reveal';
import { MessageComposer } from '../../../components/ui/message-composer';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { useSaveComment } from '../../comments';
import { useAnswerRetry, useAsk } from '../commands/conversations';
import {
  useConversations,
  type ConversationOwner,
} from '../queries/conversations';
import { walkthroughAsking } from '../store';
import { useWritesBlocked } from '../../access';

type Props = { owner: ConversationOwner };

const ANSWER_LINES = 3;

function LinkButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
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
    />
  );
}

function AddToReview({
  owner,
  stepTitle,
  text,
}: Props & { stepTitle: string; text: string }) {
  const save = useSaveComment(owner.workspace);
  const blocked = useWritesBlocked(owner.workspace.connection.environmentId);
  const [added, setAdded] = useState(false);
  if (added)
    return (
      <Text variant="caption" tone="muted" accessibilityRole="alert">
        Added to the review
      </Text>
    );
  return (
    <>
      <Button
        label="Add to review"
        variant="plain"
        size="sm"
        align="start"
        className="-ml-3.5 self-start"
        pending={save.waiting}
        disabled={blocked}
        onPress={() =>
          void save
            .add({ kind: 'step', title: stepTitle }, text)
            .then((view) => {
              if (view) setAdded(true);
            })
        }
      />
      {save.failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {save.failure}
        </Text>
      ) : null}
    </>
  );
}

function AgentReply({
  owner,
  message,
  question,
  stepTitle,
}: Props & {
  message: AgentMessage;
  question: string;
  stepTitle: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const { failure, waiting, retry } = useAnswerRetry(owner);
  const blocked = useWritesBlocked(owner.workspace.connection.environmentId);
  const state = message.state;
  return (
    <Message author="Walkthrough agent">
      {state.status === 'answering' ? (
        <Box className="items-start">
          <Spinner />
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
          disabled={waiting || blocked}
          onPress={() => retry(message.replyTo)}
        />
      ) : null}
      {state.status === 'answered' && stepTitle !== undefined ? (
        <AddToReview
          owner={owner}
          stepTitle={stepTitle}
          text={quotedAnswer(question, state.text)}
        />
      ) : null}
      {failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
    </Message>
  );
}

function Messages({
  owner,
  conversation,
  stepTitle,
}: Props & { conversation: Conversation; stepTitle: string | undefined }) {
  return developerTurns(conversation).map(({ message, reply }) => (
    <Box key={message.id} gap={3}>
      <Message align="end">
        <RichText text={message.text} />
      </Message>
      {reply ? (
        <AgentReply
          owner={owner}
          message={reply}
          question={message.text}
          stepTitle={stepTitle}
        />
      ) : null}
    </Box>
  ));
}

function Composer({
  owner,
  title,
  scroller,
}: Props & { title: string; scroller: KeyboardScroller }) {
  const { text, failure, waiting, change, send } = useAsk(owner, title);
  const blocked = useWritesBlocked(owner.workspace.connection.environmentId);
  return (
    <MessageComposer
      value={text}
      placeholder="Ask about this step"
      sending={waiting}
      disabled={blocked}
      error={failure}
      onChangeText={change}
      scroller={scroller}
      onSend={() => {
        if (blocked) return;
        Keyboard.dismiss();
        send();
      }}
    />
  );
}

export function WalkthroughConversation({
  owner,
  title,
  stepTitle,
  actions,
  scroller,
}: Props & {
  title: string;
  stepTitle: string;
  actions: ReactNode;
  scroller: KeyboardScroller;
}) {
  const { view, failed, refresh } = useConversations(owner);
  const [asking, setAsking] = useAtom(
    walkthroughAsking(JSON.stringify([owner.workspace.key, title])),
  );
  const conversations = stopConversations(view, title);
  const asked = conversations.some((item) => item.messages.length > 0);
  return (
    <Box gap={3}>
      <Box className="-ml-3.5 flex-row flex-wrap items-center">
        {actions}
        <Button
          label="Ask about this"
          variant="plain"
          size="sm"
          onPress={() => setAsking(!asking)}
        />
      </Box>
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
      {asking || asked ? (
        <>
          {conversations.length > 0 ? (
            <Box gap={4}>
              <Separator />
              {conversations.map((conversation) => (
                <Messages
                  key={conversation.runId}
                  owner={owner}
                  conversation={conversation}
                  stepTitle={stepTitle}
                />
              ))}
            </Box>
          ) : null}
          <Composer owner={owner} title={title} scroller={scroller} />
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
          stepTitle={undefined}
        />
      ))}
    </Box>
  );
}
