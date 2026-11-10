import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  archiveDescription,
  archiveFailureMessage,
  archiveOptions,
} from '@porcelain/client/projects/rules';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import { useComputerConnection } from '../store';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { Sheet } from '../../../components/ui/sheet';
import { Switch } from '../../../components/ui/switch';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { useReviewGitSettings } from '../../preferences';
import { useInventory } from '../queries/inventory';
import { useArchivePullRequest } from '../commands/archive-pull-request';

type ArchiveTarget = {
  connection: RuntimeConnection;
  number: number;
  projectId: string;
  mainWorktreeId: string;
};

function ArchivePullRequest(props: ArchiveTarget) {
  const router = useRouter();
  const view = useReviewGitSettings(props.connection);
  const settings = confirmedReviewGitSettings(view);
  const block = reviewGitSettingsBlock(view);
  const { result, prepare } = useArchivePullRequest(props);
  return (
    <>
      <Button
        label="Archive"
        variant="tonal"
        disabled={!settings}
        pending={result.waiting}
        onPress={() => {
          if (settings)
            prepare(archiveOptions(settings), () =>
              router.navigate({
                pathname: '/archive-pull-request',
                params: {
                  environmentId: props.connection.environmentId,
                  number: String(props.number),
                  projectId: props.projectId,
                  mainWorktreeId: props.mainWorktreeId,
                },
              }),
            );
        }}
      />
      {block && view.kind !== 'reading' ? (
        <Text variant="caption" tone="muted">
          {block}
        </Text>
      ) : null}
    </>
  );
}

export function ArchivePullRequestSheet({
  environmentId,
  number,
  projectId,
  mainWorktreeId,
  onClose,
}: {
  environmentId: string | undefined;
  number: number | undefined;
  projectId: string | undefined;
  mainWorktreeId: string | undefined;
  onClose: () => void;
}) {
  const connection = useComputerConnection(environmentId);
  return (
    <Sheet title="Archive pull request">
      {connection && number && projectId && mainWorktreeId ? (
        <ArchiveConfirmation
          connection={connection}
          number={number}
          projectId={projectId}
          mainWorktreeId={mainWorktreeId}
          onClose={onClose}
        />
      ) : (
        <ArchiveUnavailable />
      )}
    </Sheet>
  );
}

function ArchiveUnavailable() {
  return (
    <Empty
      title="Pull request unavailable"
      description="Return to the pull request and choose Archive again."
    />
  );
}

function ArchiveConfirmation({
  onClose,
  ...target
}: ArchiveTarget & { onClose: () => void }) {
  const settings = confirmedReviewGitSettings(
    useReviewGitSettings(target.connection),
  );
  const { result, submit } = useArchivePullRequest(target);
  const [acknowledged, setAcknowledged] = useState(false);
  const plan =
    AsyncResult.isSuccess(result) && !result.value.archived
      ? result.value.plan
      : undefined;
  const failure = AsyncResult.isFailure(result)
    ? archiveFailureMessage(Cause.squash(result.cause))
    : undefined;
  const risky = Boolean(plan && (plan.dirty || plan.unpushed));
  if (AsyncResult.isInitial(result) && !result.waiting)
    return <ArchiveUnavailable />;
  let description = 'Checking the worktree and branches…';
  if (failure) description = 'Archiving could not be completed.';
  if (plan) description = archiveDescription(plan);
  return (
    <>
      <Text>{description}</Text>
      {risky ? (
        <Box className="flex-row items-center" gap={2}>
          <Switch
            label="I understand the risk of losing changes and commits"
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
          />
          <Text className="flex-1">
            I understand the risk of losing changes and commits
          </Text>
        </Box>
      ) : null}
      {failure ? (
        <Text tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      <Button
        label="Archive pull request"
        variant="destructive"
        pending={result.waiting}
        disabled={!plan || !settings || (risky && !acknowledged)}
        onPress={() => {
          if (plan && settings)
            void submit(
              {
                options: archiveOptions(settings),
                confirmation: { plan, discardChanges: acknowledged },
              },
              onClose,
            );
        }}
      />
    </>
  );
}

export function PullRequestArchive({
  projectId,
  number,
  connection,
}: {
  projectId: string;
  number: number;
  connection: RuntimeConnection;
}) {
  const inventory = useInventory(connection);
  if (!AsyncResult.isSuccess(inventory.result)) return null;
  const project = inventory.result.value.projects.find(
    (entry) => entry.id === projectId,
  );
  const main = project?.worktrees.find(
    (entry) => entry.main && entry.available,
  );
  return main ? (
    <ArchivePullRequest
      connection={connection}
      number={number}
      projectId={projectId}
      mainWorktreeId={main.id}
    />
  ) : null;
}
