import { useState } from 'react';
import { ScrollView } from 'react-native';
import { BottomSheet, RNHostView } from '@expo/ui';
import { useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readBranchBases } from '@porcelain/client/changes';
import type { EnvironmentConnection } from '@porcelain/client/access';
import type { WorktreeCleanupPlan } from '@porcelain/client/projects';
import {
  worktreeBranchChoices,
  worktreeCleanupOptions,
  worktreeCleanupDescription,
  worktreeCleanupFailureMessage,
  worktreeCleanupFields,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { Input } from '../../../components/ui/input';
import { Item } from '../../../components/ui/item';
import { Icon } from '../../../components/ui/icon';
import { useReviewGitSettings } from '../../preferences';
import { useInventory } from '../queries/inventory';
import { useCopyPath } from '../commands/clipboard';
import {
  useDeleteWorktree,
  useSwitchWorktreeBranch,
} from '../commands/worktree-actions';

export type WorktreeActionRequest = {
  kind: 'menu' | 'delete' | 'switch';
  entry: NavigatorEntry;
  worktreeId: string;
  connection: EnvironmentConnection;
  requestId: string;
};

export function WorktreeActionSheet({
  request,
  onClose,
  onAction,
}: {
  request: WorktreeActionRequest | undefined;
  onClose: () => void;
  onAction: (kind: 'delete' | 'switch') => void;
}) {
  return (
    <BottomSheet
      isPresented={request !== undefined}
      onDismiss={onClose}
      contentPadding={0}
      snapPoints={request?.kind === 'menu' ? ['half'] : ['full']}
    >
      {request && (
        <RNHostView>
          <ScrollView
            className="flex-1 bg-background"
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <Box paddingX={6} paddingY={8} gap={4}>
              <WorktreeActionContent
                key={request.requestId}
                request={request}
                onClose={onClose}
                onAction={onAction}
              />
            </Box>
          </ScrollView>
        </RNHostView>
      )}
    </BottomSheet>
  );
}

function WorktreeActionContent({
  request,
  onClose,
  onAction,
}: {
  request: WorktreeActionRequest;
  onClose: () => void;
  onAction: (kind: 'delete' | 'switch') => void;
}) {
  switch (request.kind) {
    case 'menu':
      return (
        <WorktreeMenu request={request} onClose={onClose} onAction={onAction} />
      );
    case 'delete':
      return <DeleteWorktreeContent request={request} onClose={onClose} />;
    case 'switch':
      return (
        <SwitchWorktreeBranchContent request={request} onClose={onClose} />
      );
  }
}

function WorktreeMenu({
  request,
  onClose,
  onAction,
}: {
  request: WorktreeActionRequest;
  onClose: () => void;
  onAction: (kind: 'delete' | 'switch') => void;
}) {
  const clipboard = useCopyPath();
  const context = `${request.entry.name}, ${request.entry.projectName}, ${request.entry.environmentName}`;
  return (
    <Box gap={2}>
      {request.entry.path && (
        <Item
          title="Copy worktree path"
          leading={<Icon name="copy" />}
          accessibilityLabel={`Copy worktree path, ${context}`}
          disabled={clipboard.result.waiting}
          onPress={() => {
            if (request.entry.path) clipboard.copy(request.entry.path, onClose);
          }}
        />
      )}
      <Item
        title="Switch branch"
        leading={<Icon name="review" />}
        accessibilityLabel={`Switch branch, ${context}`}
        disabled={!request.entry.available || clipboard.result.waiting}
        onPress={() => onAction('switch')}
      />
      {!request.entry.main && (
        <Item
          title="Delete"
          leading={<Icon name="trash" tone="destructive" />}
          accessibilityLabel={`Delete worktree, ${context}`}
          disabled={clipboard.result.waiting}
          onPress={() => onAction('delete')}
        />
      )}
      {AsyncResult.isFailure(clipboard.result) && (
        <Text tone="destructive" accessibilityRole="alert">
          {connectionErrorMessage(Cause.squash(clipboard.result.cause))}
        </Text>
      )}
      <Button label="Cancel" variant="outline" onPress={onClose} />
    </Box>
  );
}

function DeleteWorktreeContent({
  request,
  onClose,
}: {
  request: WorktreeActionRequest;
  onClose: () => void;
}) {
  const view = useReviewGitSettings(request.connection);
  const settings = confirmedReviewGitSettings(view);
  const block = reviewGitSettingsBlock(view);
  return (
    <>
      <Text variant="heading">Delete {request.entry.name}?</Text>
      <Text>
        Choose what to delete this time. Your saved settings won’t change.
        Review history stays available.
      </Text>
      {settings ? (
        <DeleteWorktreeOptions
          request={request}
          settings={settings}
          onClose={onClose}
        />
      ) : (
        <>
          <Text tone="muted">{block ?? 'Reading deletion settings…'}</Text>
          <Button label="Cancel" variant="outline" onPress={onClose} />
        </>
      )}
    </>
  );
}

function DeleteWorktreeOptions({
  request,
  settings,
  onClose,
}: {
  request: WorktreeActionRequest;
  settings: ReviewGitSettings;
  onClose: () => void;
}) {
  const [options, setOptions] = useState(() =>
    worktreeCleanupOptions(settings, request.entry.detached),
  );
  const [plan, setPlan] = useState<WorktreeCleanupPlan>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const command = useDeleteWorktree({
    connection: request.connection,
    scope: {
      projectId: request.entry.projectId,
      worktreeId: request.worktreeId,
    },
  });
  const failure =
    attempted && AsyncResult.isFailure(command.result)
      ? worktreeCleanupFailureMessage(Cause.squash(command.result.cause))
      : undefined;
  const needsAcknowledgement = Boolean(plan && (plan.dirty || plan.unpushed));
  const hasDeletion =
    options.deleteWorktree ||
    options.deleteLocalBranch ||
    options.deleteRemoteBranch;
  return (
    <>
      <Box gap={3}>
        {worktreeCleanupFields.map(({ key, label }) => (
          <Box
            key={key}
            className="flex-row items-center justify-between"
            gap={2}
          >
            <Text variant="ui" weight="medium" className="min-w-0 flex-1">
              {label}
            </Text>
            <Switch
              label={label}
              checked={options[key]}
              disabled={
                command.result.waiting ||
                (request.entry.detached && key !== 'deleteWorktree')
              }
              onCheckedChange={(checked) => {
                setOptions((current) => ({ ...current, [key]: checked }));
                setPlan(undefined);
                setAcknowledged(false);
                setAttempted(false);
              }}
            />
          </Box>
        ))}
      </Box>
      {request.entry.detached && (
        <Text variant="caption" tone="muted">
          This worktree is detached: there is no checked-out branch to delete.
        </Text>
      )}
      {!request.entry.detached &&
        !options.deleteWorktree &&
        options.deleteLocalBranch && (
          <Text variant="caption" tone="muted">
            Keep the worktree folder and its files, detach it from the branch,
            then delete the local branch.
          </Text>
        )}
      {!request.entry.detached &&
        options.deleteWorktree &&
        !options.deleteLocalBranch && (
          <Text variant="caption" tone="muted">
            The worktree folder will be deleted. The local branch will be kept.
          </Text>
        )}
      <Text variant="caption" tone="muted">
        {request.entry.path} · {request.entry.environmentName}
      </Text>
      {plan && <Text>{worktreeCleanupDescription(plan)}</Text>}
      {needsAcknowledgement && (
        <Box className="flex-row items-center" gap={2}>
          <Switch
            label="I understand the risk of losing changes and commits"
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
            disabled={command.result.waiting}
          />
          <Text variant="caption" className="flex-1">
            I understand the risk of losing changes and commits
          </Text>
        </Box>
      )}
      {failure && (
        <Text tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      )}
      <Box className="flex-row justify-end" gap={2}>
        <Button
          label="Cancel"
          variant="outline"
          disabled={command.result.waiting}
          onPress={onClose}
        />
        <Button
          label={plan ? 'Delete' : 'Review deletion'}
          variant="destructive"
          pending={command.result.waiting}
          disabled={
            !hasDeletion ||
            Boolean(plan?.mainCheckout) ||
            (needsAcknowledgement && !acknowledged)
          }
          onPress={() => {
            setAttempted(true);
            if (plan)
              command.confirm(
                {
                  options,
                  confirmation: { plan, discardChanges: acknowledged },
                },
                onClose,
                () => {
                  setPlan(undefined);
                  setAcknowledged(false);
                },
              );
            else command.preview(options, setPlan);
          }}
        />
      </Box>
    </>
  );
}

function SwitchWorktreeBranchContent({
  request,
  onClose,
}: {
  request: WorktreeActionRequest;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string>();
  const [attempted, setAttempted] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const selection = {
    connection: request.connection,
    scope: {
      projectId: request.entry.projectId,
      worktreeId: request.worktreeId,
    },
  };
  const result = useAtomValue(readBranchBases(selection));
  const answer = Option.getOrUndefined(AsyncResult.value(result));
  const inventory = useInventory(request.connection);
  const project = Option.getOrUndefined(
    AsyncResult.value(inventory.result),
  )?.projects.find((project) => project.id === request.entry.projectId);
  const choices = worktreeBranchChoices(
    project ? (answer?.bases ?? []) : [],
    project?.worktrees ?? [],
    request.worktreeId,
  ).filter((choice) =>
    choice.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const command = useSwitchWorktreeBranch(selection);
  const outcome = recovering ? command.recovered : command.result;
  const failure =
    attempted && AsyncResult.isFailure(outcome)
      ? connectionErrorMessage(Cause.squash(outcome.cause))
      : undefined;
  const receipt = attempted
    ? Option.getOrUndefined(AsyncResult.value(outcome))
    : undefined;
  const eligible = choices.some(
    (choice) => choice.ref === chosen && !choice.current && !choice.inUse,
  );
  let submitLabel = 'Switch branch';
  if (command.unresolved) submitLabel = 'Check outcome';
  if (command.pending) submitLabel = 'Checking switch';
  return (
    <>
      <Text variant="heading">Switch branch</Text>
      <Text>
        Choose a branch for {request.entry.name}. Branches used by another
        worktree are unavailable.
      </Text>
      <Input
        accessibilityLabel="Find a branch"
        placeholder="Find a branch"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        disabled={command.pending}
      />
      {(AsyncResult.isInitial(result) ||
        AsyncResult.isInitial(inventory.result)) && (
        <Text tone="muted">Reading branches…</Text>
      )}
      {(AsyncResult.isFailure(result) ||
        AsyncResult.isFailure(inventory.result)) && (
        <Text tone="destructive" accessibilityRole="alert">
          Branches could not be read.
        </Text>
      )}
      {answer && choices.length === 0 && (
        <Text tone="muted">No matching branch</Text>
      )}
      <Box gap={1}>
        {choices.map((choice) => {
          let description: string | undefined;
          if (choice.current) description = 'Current';
          if (choice.inUse) description = 'In use';
          return (
            <Item
              key={choice.ref}
              title={choice.name}
              titleNumberOfLines={1}
              {...(description ? { description } : {})}
              trailing={
                chosen === choice.ref || choice.current ? (
                  <Icon name="check" />
                ) : undefined
              }
              selected={chosen === choice.ref}
              disabled={
                choice.current ||
                choice.inUse ||
                command.pending ||
                command.unresolved
              }
              accessibilityLabel={`${choice.name}${choice.current ? ', Current' : ''}${choice.inUse ? ', In use by another worktree' : ''}`}
              onPress={() => setChosen(choice.ref)}
            />
          );
        })}
      </Box>
      {command.unresolved && (
        <Text tone="muted">
          The previous switch is not confirmed. Check its outcome before
          switching again.
        </Text>
      )}
      {failure && (
        <Text tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      )}
      {receipt &&
        receipt.state !== 'succeeded' &&
        receipt.state !== 'no-change' && (
          <Text tone="destructive" accessibilityRole="alert">
            {receipt.message ?? 'The branch could not be switched.'}
          </Text>
        )}
      <Box className="flex-row justify-end" gap={2}>
        <Button
          label="Cancel"
          variant="outline"
          disabled={command.pending}
          onPress={onClose}
        />
        <Button
          label={submitLabel}
          disabled={!command.unresolved && !eligible}
          pending={command.pending}
          onPress={() => {
            if (!command.unresolved && !eligible) return;
            setAttempted(true);
            setRecovering(command.unresolved);
            command.submit(chosen, onClose);
          }}
        />
      </Box>
    </>
  );
}
