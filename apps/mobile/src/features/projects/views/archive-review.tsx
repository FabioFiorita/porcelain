import { useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  archiveDescription,
  archiveFailureMessage,
} from '@porcelain/client/reviews/rules';
import { archiveOptions } from '@porcelain/client/preferences/rules';
import { Button } from '../../../components/ui/button';
import { AlertDialog } from '../../../components/ui/alert-dialog';
import { Switch } from '../../../components/ui/switch';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { usePreferences } from '../../preferences';
import {
  useArchiveReview,
  type ArchivePlan,
  type ArchiveOptions,
} from '../commands/archive-review';
export function ArchiveReview(props: {
  connection: RuntimeConnection;
  reviewId: string;
  projectId: string;
  mainWorktreeId: string;
}) {
  const { preferences, status } = usePreferences();
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
        disabled={status !== 'ready'}
        pending={result.waiting}
        onPress={() => {
          const next = archiveOptions(preferences);
          setPlan(undefined);
          setAcknowledged(false);
          setOptions(next);
          setOpen(true);
          prepare(next, (answer) => setPlan(answer.plan));
        }}
      />
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
