import { useAtomRef, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readCommitModels } from '@porcelain/client/git-actions';
import {
  groupedCommitModels,
  resolveCommitModel,
} from '@porcelain/client/git-actions/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  remoteConnectionState,
  selectionState,
} from '../../../shared/application/store';
import { Box } from '../../../components/ui/box';
import { ErrorState } from '../../../components/ui/error-state';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { usePreferences } from '../store';
import { PreferenceChoice } from './preference-choice';

export function CommitModelSetting() {
  const connections = useAtomRef(remoteConnectionState);
  const selection = useAtomRef(selectionState);
  const current = connections.find(
    (entry) => entry.remote.environmentId === selection.currentEnvironmentId,
  );
  return current ? (
    <ConnectedCommitModel
      connection={current.connection}
      name={current.remote.name}
    />
  ) : (
    <Item
      title="Commit model"
      description="Open a workspace on a computer to choose from its installed coding models."
      variant="outline"
    />
  );
}

function ConnectedCommitModel({
  connection,
  name,
}: {
  connection: RuntimeConnection;
  name: string;
}) {
  const atom = readCommitModels(connection);
  const models = useAtomValue(atom);
  const retry = useAtomRefresh(atom);
  const { preferences, status, setPreferences } = usePreferences();
  const choices = Option.getOrUndefined(AsyncResult.value(models));
  const selected = resolveCommitModel(choices, preferences.commitModel);
  const groups = groupedCommitModels(
    choices?.filter((model) => !model.id.endsWith(':default')) ?? [],
  );
  return (
    <Box gap={2}>
      <Text variant="subheading">Commit model</Text>
      <Text variant="caption" tone="muted">
        Models from {name}. Saves the default for commit drafts on this device.
      </Text>
      {AsyncResult.isInitial(models) ? (
        <Loading label="Loading models…" />
      ) : null}
      {AsyncResult.isFailure(models) ? (
        <ErrorState
          message={String(Cause.squash(models.cause))}
          retry={{ label: 'Read models again', onPress: retry }}
        />
      ) : null}
      {groups.map(([provider, entries]) => (
        <PreferenceChoice
          key={provider}
          label={provider}
          description="Choose a commit model."
          value={selected ?? ''}
          options={entries.map((model) => ({
            id: model.id,
            value: model.id,
            label: model.label,
          }))}
          disabled={status !== 'ready'}
          onChange={(commitModel) => setPreferences({ commitModel })}
        />
      ))}
      {!models.waiting && choices && groups.length === 0 ? (
        <Text variant="caption" tone="muted">
          Install and sign in to Codex or Claude Code on {name} to generate
          drafts.
        </Text>
      ) : null}
    </Box>
  );
}
