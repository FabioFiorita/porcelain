import { useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { Project } from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Sheet } from '../../../components/ui/sheet';
import { Text } from '../../../components/ui/text';
import { useInventory } from '../queries/inventory';
import { useProjectActions } from '../commands/project-actions';

export function RenameProjectSheet({
  environmentId,
  projectId,
  onClose,
}: {
  environmentId: string | undefined;
  projectId: string | undefined;
  onClose: () => void;
}) {
  const connection = useAtomRef(remoteConnectionState).find(
    (entry) => entry.remote.environmentId === environmentId,
  )?.connection;
  const inventory = useInventory(connection);
  const project = Option.getOrUndefined(
    AsyncResult.value(inventory.result),
  )?.projects.find((entry) => entry.id === projectId);
  return (
    <Sheet title="Rename project">
      {connection && project ? (
        <RenameProjectForm
          connection={connection}
          project={project}
          onClose={onClose}
        />
      ) : (
        <Empty
          title="Project unavailable"
          description="Return to Worktrees and choose the project again."
        />
      )}
    </Sheet>
  );
}

function RenameProjectForm({
  connection,
  project,
  onClose,
}: {
  connection: RuntimeConnection;
  project: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const commands = useProjectActions(connection, project.id);
  const result = commands.renameResult;
  const failure = AsyncResult.isFailure<unknown, unknown>(result)
    ? connectionErrorMessage(Cause.squash(result.cause))
    : undefined;
  return (
    <>
      <Field label="Name">
        <Input
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          disabled={result.waiting}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (name.trim()) commands.rename(name.trim(), onClose);
          }}
        />
      </Field>
      {failure && (
        <Text tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      )}
      <Button
        label="Rename"
        pending={result.waiting}
        disabled={!name.trim()}
        onPress={() => commands.rename(name.trim(), onClose)}
      />
    </>
  );
}
