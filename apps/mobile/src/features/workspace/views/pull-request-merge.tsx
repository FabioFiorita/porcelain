import { useAtomValue } from '@effect/atom-react';
import { useRouter } from 'expo-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readComments } from '@porcelain/client/comments';
import { openComments } from '@porcelain/client/comments/rules';
import { pullRequestMergeable } from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { SectionHeading } from '../../../components/ui/section-heading';
import { Separator } from '../../../components/ui/separator';
import { StateIcon, type RunState } from '../../../components/ui/state-icon';
import { Text } from '../../../components/ui/text';
import {
  PullRequestArchive,
  useSelectedWorkspaceKey,
  workspaceKey,
} from '../../projects/index';
import type {
  PullRequestRef,
  usePullRequestMerge,
} from '../queries/pull-request';
import type { ReactNode } from 'react';

type Merge = ReturnType<typeof usePullRequestMerge>;

const blockerStates: Record<'failed' | 'running' | 'none', RunState> = {
  failed: 'failed',
  running: 'running',
  none: 'pending',
};

function Note({
  state,
  children,
  action,
}: {
  state: RunState;
  children: string;
  action?: ReactNode;
}) {
  return (
    <Box className="min-h-8 flex-row items-center" gap={2}>
      <StateIcon state={state} />
      <Text variant="secondary" className="min-w-0 flex-1">
        {children}
      </Text>
      {action}
    </Box>
  );
}

export function PullRequestMergeArea({
  target,
  merge,
}: {
  target: PullRequestRef;
  merge: Merge;
}) {
  const router = useRouter();
  const { pull } = merge;
  const open = pull.state === 'open';
  const selected = useSelectedWorkspaceKey();
  const checkoutKey = merge.checkout
    ? workspaceKey(target.connection, merge.checkout)
    : undefined;
  const here = checkoutKey !== undefined && checkoutKey === selected;
  const staleWalkthrough =
    merge.walkthroughHead !== undefined &&
    merge.walkthroughHead !== pull.headSha;
  return (
    <Box gap={1}>
      <SectionHeading
        label="Merge"
        trailing={
          <Text variant="caption" tone="muted">
            {open ? `${pullRequestMergeable(pull.mergeable).label} · ` : ''}
            <Text variant="mono">{pull.headSha.slice(0, 7)}</Text>
          </Text>
        }
      />
      {pull.state === 'merged' ? (
        <Note state="passed">{`Merged into ${pull.baseBranch}.`}</Note>
      ) : null}
      {pull.state === 'closed' ? (
        <Note state="skipped">Closed without merging.</Note>
      ) : null}
      {!open ? (
        <PullRequestArchive
          projectId={target.projectId}
          number={target.number}
          connection={target.connection}
        />
      ) : null}
      {open
        ? merge.blockers.map((blocker) => (
            <Note key={blocker.key} state={blockerStates[blocker.tone]}>
              {blocker.text}
            </Note>
          ))
        : null}
      {open && merge.blockers.length === 0 && merge.status ? (
        <Note state="passed">Nothing on GitHub blocks the merge.</Note>
      ) : null}
      {open && staleWalkthrough ? (
        <Note
          state="pending"
          action={
            here ? (
              <Button
                label="Open Walkthrough"
                variant="plain"
                size="sm"
                onPress={() =>
                  router.navigate('/(tabs)/(walkthrough)/walkthrough')
                }
              />
            ) : undefined
          }
        >
          {`The Walkthrough covers ${merge.walkthroughHead?.slice(0, 7)}; the pull request is at ${pull.headSha.slice(0, 7)}.`}
        </Note>
      ) : null}
      {open
        ? merge.callNotes.map(({ step, state }) => (
            <Note
              key={`${state}:${step}`}
              state="pending"
              action={
                here && checkoutKey ? (
                  <Button
                    label={`Open step ${step}`}
                    variant="plain"
                    size="sm"
                    onPress={() =>
                      router.navigate({
                        pathname: '/(tabs)/(walkthrough)/walkthrough-step',
                        params: { workspace: checkoutKey, step: String(step) },
                      })
                    }
                  />
                ) : undefined
              }
            >
              {`Your call in Walkthrough step ${step} ${state}. Merge waits for it.`}
            </Note>
          ))
        : null}
      {open && merge.checkout ? (
        <DraftNote
          target={target}
          checkout={merge.checkout}
          workspace={here ? checkoutKey : undefined}
        />
      ) : null}
      {open ? <Separator /> : null}
      {open ? (
        <Box paddingTop={2} gap={3} className="flex-row items-center">
          <Button
            label="Merge"
            size="sm"
            disabled={merge.block !== undefined}
            onPress={() =>
              router.push({
                pathname: '/merge-pull-request',
                params: {
                  environment: target.connection.environmentId,
                  projectId: target.projectId,
                  number: String(target.number),
                },
              })
            }
          />
          {merge.block ? (
            <Text variant="secondary" tone="muted" className="min-w-0 flex-1">
              {merge.block}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function DraftNote({
  target,
  checkout,
  workspace,
}: {
  target: PullRequestRef;
  checkout: { projectId: string; worktreeId: string };
  workspace: string | undefined;
}) {
  const router = useRouter();
  const view = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        readComments({ connection: target.connection, scope: checkout }),
      ),
    ),
  );
  const count = openComments(view).length;
  if (count === 0) return null;
  return (
    <Note
      state="pending"
      action={
        workspace ? (
          <Button
            label="Publish review"
            variant="plain"
            size="sm"
            onPress={() =>
              router.push({
                pathname: '/publish-comments',
                params: { workspace },
              })
            }
          />
        ) : undefined
      }
    >
      {count === 1
        ? '1 draft comment is not published yet.'
        : `${count} draft comments are not published yet.`}
    </Note>
  );
}
