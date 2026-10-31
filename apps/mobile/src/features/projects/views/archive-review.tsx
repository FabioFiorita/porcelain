import { useState } from 'react';
import { useAtomValue } from '@effect/atom-react';
import { readReview } from '@porcelain/client/reviews';
import { useInventory } from '../queries/inventory';
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
import { Button } from '../../../components/ui/button';
import { AlertDialog } from '../../../components/ui/alert-dialog';
import { Switch } from '../../../components/ui/switch';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { useReviewGitSettings } from '../../preferences';
import {
  useArchiveReview,
  type ArchivePlan,
  type ArchiveOptions,
} from '../commands/archive-review';
function ArchiveReview(props: {
  connection: RuntimeConnection;
  reviewId: string;
  projectId: string;
  mainWorktreeId: string;
}) {
  const view = useReviewGitSettings(props.connection);
  const settings = confirmedReviewGitSettings(view);
  const block = reviewGitSettingsBlock(view);
  const { result, prepare, submit } = useArchiveReview(props);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<ArchivePlan>();
  const [options, setOptions] = useState<ArchiveOptions>();
  const [acknowledged, setAcknowledged] = useState(false);
  const failure = AsyncResult.isFailure(result)
    ? archiveFailureMessage(Cause.squash(result.cause))
    : undefined;
  let description = 'Checking the worktree and branches…';
  if (failure) description = 'Archiving could not be completed.';
  if (plan) description = archiveDescription(plan);
  return (
    <>
      <Button
        label="Archive"
        variant="outline"
        disabled={!settings}
        pending={result.waiting}
        onPress={() => {
          if (!settings) return;
          const next = archiveOptions(settings);
          setPlan(undefined);
          setAcknowledged(false);
          setOptions(next);
          setOpen(true);
          prepare(next, (answer) => setPlan(answer.plan));
        }}
      />
      {block && view.kind !== 'reading' ? (
        <Text variant="caption" tone="muted">
          {block}
        </Text>
      ) : null}
      <AlertDialog
        open={open}
        title="Archive review?"
        description={description}
        pending={result.waiting}
        disabled={
          !plan || Boolean((plan.dirty || plan.unpushed) && !acknowledged)
        }
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          if (plan && options)
            void submit(
              { options, confirmation: { plan, discardChanges: acknowledged } },
              () => setOpen(false),
            );
        }}
      >
        {plan && (plan.dirty || plan.unpushed) ? (
          <Box className="flex-row items-center" gap={2} paddingY={3}>
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
        {failure ? <Text tone="destructive">{failure}</Text> : null}
      </AlertDialog>
    </>
  );
}

export function PullRequestArchive({
  projectId,
  reviewId,
  connection,
}: {
  projectId: string;
  reviewId: string;
  connection: RuntimeConnection;
}) {
  const inventory = useInventory(connection);
  const review = useAtomValue(readReview({ connection, reviewId }));
  if (
    !AsyncResult.isSuccess(inventory.result) ||
    !AsyncResult.isSuccess(review) ||
    !review.value.review ||
    review.value.review.archived ||
    review.value.review.projectId !== projectId
  )
    return null;
  const project = inventory.result.value.projects.find(
    (entry) => entry.id === projectId,
  );
  const main = project?.worktrees.find(
    (entry) => entry.main && entry.available,
  );
  return main ? (
    <ArchiveReview
      connection={connection}
      reviewId={reviewId}
      projectId={projectId}
      mainWorktreeId={main.id}
    />
  ) : null;
}
