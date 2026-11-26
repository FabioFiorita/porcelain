import { Fragment, useState } from 'react';
import { useRouter } from 'expo-router';
import { Option, Schema } from 'effect';
import {
  mergeConfirmation,
  pullRequestMergeMethods,
  type PullRequestMergeMethod,
  type PullRequestRead,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Empty } from '../../../components/ui/empty';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { Sheet } from '../../../components/ui/sheet';
import { StateIcon } from '../../../components/ui/state-icon';
import { Text } from '../../../components/ui/text';
import {
  pullRequestTargetSchema,
  type PullRequestTarget,
} from '../../../shared/rules/pull-request-target';
import { ComputerConnectionNotice } from '../../access';
import {
  PullRequestArchive,
  useComputerConnection,
} from '../../projects/index';
import { useScreenActivity } from '../adapters/page-activity';
import { useMergePullRequest } from '../commands/pull-request';
import {
  usePullRequestMerge,
  type PullRequestRef,
} from '../queries/pull-request';
import { PullRequestReadState } from './pull-request-read';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];

export function MergePullRequestSheet({
  params,
}: {
  params: { environment?: unknown; projectId?: unknown; number?: unknown };
}) {
  const target = Schema.decodeUnknownOption(pullRequestTargetSchema)({
    environmentId: params.environment,
    projectId: params.projectId,
    number: Number(params.number),
  });
  return (
    <Sheet
      title={Option.isSome(target) ? `Merge #${target.value.number}` : 'Merge'}
    >
      {Option.isSome(target) ? (
        <>
          <ConnectedMerge target={target.value} />
          <ComputerConnectionNotice
            environmentId={target.value.environmentId}
          />
        </>
      ) : (
        <Empty title="Pull request unavailable" />
      )}
    </Sheet>
  );
}

function ConnectedMerge({ target }: { target: PullRequestTarget }) {
  const connection = useComputerConnection(target.environmentId);
  if (!connection) return <Empty title="Pull request unavailable" />;
  return (
    <ReadMerge
      target={{
        connection,
        projectId: target.projectId,
        number: target.number,
      }}
    />
  );
}

function ReadMerge({ target }: { target: PullRequestRef }) {
  return (
    <PullRequestReadState target={target}>
      {(pull) => <MergeConfirmation target={target} pull={pull} />}
    </PullRequestReadState>
  );
}

function MergeConfirmation({
  target,
  pull,
}: {
  target: PullRequestRef;
  pull: PullRequest;
}) {
  const router = useRouter();
  const activity = useScreenActivity();
  const merge = usePullRequestMerge(target, pull, activity);
  const [pin, setPin] = useState<string>();
  if (pin === undefined && (merge.status || merge.problem))
    setPin(merge.pull.headSha);
  const pinned = pin ?? merge.pull.headSha;
  const [done, setDone] = useState(false);
  const options = pullRequestMergeMethods(merge.pull);
  const [method, setMethod] = useState<PullRequestMergeMethod | undefined>(
    options[0]?.method,
  );
  const command = useMergePullRequest(target, () => setDone(true));
  const chosen = options.find((option) => option.method === method);
  const confirmation = mergeConfirmation({ ...merge.pull, headSha: pinned });
  if (done || merge.pull.state === 'merged')
    return (
      <>
        <Box className="flex-row items-center" gap={2}>
          <StateIcon state="passed" />
          <Text className="flex-1">{`Merged #${pull.number} into ${pull.baseBranch}.`}</Text>
        </Box>
        <PullRequestArchive
          projectId={target.projectId}
          number={target.number}
          connection={target.connection}
        />
        <Button label="Done" variant="tonal" onPress={() => router.back()} />
      </>
    );
  const moved = pin !== undefined && merge.pull.headSha !== pin;
  const block = moved
    ? `New commits arrived (${merge.pull.headSha.slice(0, 7)}) after this opened. Close it and review them first.`
    : merge.block;
  return (
    <>
      <Text>{confirmation.description}</Text>
      {options.length > 1 ? (
        <Card>
          {options.map((option, index) => (
            <Fragment key={option.method}>
              {index > 0 ? <Separator inset="content" /> : null}
              <Item
                size="compact"
                title={option.label}
                selected={option.method === method}
                selectionTone="neutral"
                trailing={
                  option.method === method ? (
                    <Icon name="check" tone="brand" size="small" />
                  ) : undefined
                }
                accessibilityLabel={`Method: ${option.label}${option.method === method ? ', selected' : ''}`}
                disabled={command.pending}
                onPress={() => setMethod(option.method)}
              />
            </Fragment>
          ))}
        </Card>
      ) : null}
      {block ? (
        <Box className="flex-row items-center" gap={2}>
          <StateIcon state={merge.blockShown || moved ? 'pending' : 'failed'} />
          <Text variant="secondary" className="flex-1">
            {block}
          </Text>
        </Box>
      ) : null}
      <Button
        label={chosen?.label ?? 'Merge'}
        pending={command.pending}
        disabled={block !== undefined || !chosen || pin === undefined}
        onPress={() => {
          if (chosen && block === undefined && pin !== undefined)
            void command.submit(chosen.method, pin);
        }}
      />
      {command.failure ? (
        <Text variant="secondary" tone="destructive" accessibilityRole="alert">
          {command.failure}
        </Text>
      ) : null}
    </>
  );
}
