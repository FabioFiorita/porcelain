import { useState, type ReactNode } from 'react';
import {
  attentionLabel,
  callDecisionProgress,
  foldedNotSaid,
  nothingCaptured,
  plainText,
  walkthroughCalls,
  walkthroughEvidenceNotice,
  walkthroughVerified,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { verifiedChecks } from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { CardRows } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { RichText } from '../../../components/ui/rich-text';
import { Text } from '../../../components/ui/text';
import { CommentsSummary } from '../../comments';
import type { Workspace } from '../../projects/index';
import {
  useConversations,
  type ConversationOwner,
} from '../queries/conversations';
import type { WalkthroughPull } from '@porcelain/client/walkthroughs';
import { RESULT_ICONS } from './walkthrough-blocks';

export type Jump = (target: string) => void;

export const stepTarget = (step: number) => `step:${step}`;
export const callTarget = (step: number, call: number) =>
  `call:${step}:${call}`;

function Row({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Box gap={1} paddingY={3}>
      <Box className="flex-row items-baseline" paddingX={4} gap={2}>
        <Text variant="caption" tone="muted" accessibilityRole="header">
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </Box>
      {children}
    </Box>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <Box paddingX={4} paddingY={1}>
      {children}
    </Box>
  );
}

function Calls({
  content,
  decisions,
  jump,
}: {
  content: WalkthroughContent;
  decisions:
    | readonly { step: number; call: number; option?: string | undefined }[]
    | undefined;
  jump: Jump;
}) {
  const calls = walkthroughCalls(content);
  if (calls.length === 0)
    return (
      <Line>
        <Text variant="secondary" tone="muted">
          Nothing needs your decision.
        </Text>
      </Line>
    );
  return calls.map(({ attention, step, callIndex }) => {
    const decided = decisions?.find(
      (entry) => entry.step === step && entry.call === callIndex,
    );
    const label = attentionLabel(attention);
    return (
      <Item
        key={`${step}:${callIndex}`}
        size="compact"
        title={plainText(attention.question)}
        description={decided?.option ? `${label} · ${decided.option}` : label}
        leading={
          decided ? (
            <Icon name="check" tone="add" size="small" />
          ) : (
            <Icon name="warning" tone="muted" size="small" />
          )
        }
        trailing={
          <Text variant="caption" tone="muted">
            Step {step}
          </Text>
        }
        accessibilityLabel={`${decided ? 'Decided' : label}: ${plainText(attention.question)}${decided?.option ? `, ${decided.option}` : ''}, step ${step}`}
        onPress={() => jump(callTarget(step, callIndex))}
      />
    );
  });
}

function Verified({
  run,
  verified: { checks: captured, screenshots },
  pull,
  jump,
}: {
  run: WalkthroughRun;
  verified: ReturnType<typeof walkthroughVerified>;
  pull: WalkthroughPull;
  jump: Jump;
}) {
  const notice = walkthroughEvidenceNotice(run);
  const checks = verifiedChecks(captured, pull);
  return (
    <>
      {checks.map(({ step, tone, moved, line }) => {
        const icon = RESULT_ICONS[tone];
        return (
          <Item
            key={`checks:${step}`}
            size="compact"
            title={line.text}
            {...(line.captured ? { description: line.captured } : {})}
            leading={<Icon name={icon.name} tone={icon.tone} size="small" />}
            trailing={
              <Text variant="caption" tone="muted">
                Step {step}
              </Text>
            }
            accessibilityLabel={`${line.text}, step ${step}`}
            onPress={() => jump(stepTarget(step))}
          >
            {moved && pull ? (
              <Text variant="caption" tone="warn">
                #{pull.number} is now at {moved}
              </Text>
            ) : null}
          </Item>
        );
      })}
      {screenshots ? (
        <Item
          size="compact"
          title={screenshots.text}
          leading={<Icon name="image" tone="muted" size="small" />}
          trailing={
            <Text variant="caption" tone="muted">
              {screenshots.steps}
            </Text>
          }
          onPress={() => jump(stepTarget(screenshots.first))}
        />
      ) : null}
      {notice ? (
        <Line>
          <Text variant="secondary" tone="muted">
            {notice}
          </Text>
        </Line>
      ) : null}
      {!notice && checks.length === 0 && !screenshots ? (
        <Line>
          <Text variant="secondary" tone="muted">
            {nothingCaptured(run)}
          </Text>
        </Line>
      ) : null}
    </>
  );
}

function NotVerified({ content }: { content: WalkthroughContent }) {
  const [open, setOpen] = useState(false);
  const { explained, unclear, hidden } = foldedNotSaid(content, open);
  return (
    <Box paddingX={4} gap={1}>
      {unclear.map((item, index) => (
        <RichText key={`${index}:${item}`} text={item} variant="secondary" />
      ))}
      {explained.map((item, index) => (
        <Text key={`${index}:${item.point}`} variant="secondary">
          <RichText text={item.point} variant="secondary" weight="medium" />{' '}
          <RichText text={item.answer} variant="secondary" tone="muted" />
        </Text>
      ))}
      {hidden > 0 ? (
        <Button
          label={`${hidden} more`}
          variant="plain"
          size="sm"
          align="start"
          className="-ml-3.5 self-start"
          onPress={() => setOpen(true)}
        />
      ) : null}
    </Box>
  );
}

export function Briefing({
  workspace,
  owner,
  run,
  content,
  pull,
  jump,
}: {
  workspace: Workspace;
  owner: ConversationOwner;
  run: WalkthroughRun;
  content: WalkthroughContent;
  pull: WalkthroughPull;
  jump: Jump;
}) {
  const { view } = useConversations(owner);
  const progress = callDecisionProgress(content, view?.decisions);
  return (
    <Box gap={2}>
      <Text variant="secondary" weight="semibold" accessibilityRole="header">
        Before you merge
      </Text>
      <CardRows>
        <Row
          label={progress.total === 1 ? 'Your call' : 'Your calls'}
          detail={
            progress.total === 0
              ? undefined
              : `${progress.decided} of ${progress.total} decided`
          }
        >
          <Calls content={content} decisions={view?.decisions} jump={jump} />
        </Row>
        <Row label="Verified">
          <Verified
            run={run}
            verified={walkthroughVerified(content)}
            pull={pull}
            jump={jump}
          />
        </Row>
        {foldedNotSaid(content, false).total > 0 ? (
          <Row label="Not verified">
            <NotVerified content={content} />
          </Row>
        ) : null}
        <Row label="Comments">
          <Box paddingX={4}>
            <CommentsSummary workspace={workspace} />
          </Box>
        </Row>
      </CardRows>
    </Box>
  );
}
