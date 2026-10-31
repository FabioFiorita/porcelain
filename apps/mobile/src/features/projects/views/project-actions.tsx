import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ScrollView } from 'react-native';
import { BottomSheet, RNHostView } from '@expo/ui';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { projectPath, type Project } from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ProjectActionMenu } from './project-action-menu';
import { useProjectActions } from '../commands/project-actions';

export function ProjectActions({
  connection,
  project,
  environmentName,
  onCopy,
}: {
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  onCopy: (path: string) => void;
}) {
  const [request, setRequest] = useState<{
    kind: 'rename' | 'remove';
    id: string;
  }>();
  const close = () => setRequest(undefined);
  return (
    <>
      <ProjectActionMenu
        label={`Project actions: ${project.name} · ${environmentName}`}
        actions={[
          {
            id: 'copy',
            label: 'Copy path',
            onPress: () => onCopy(projectPath(project)),
          },
          {
            id: 'rename',
            label: 'Rename project',
            onPress: () => setRequest({ kind: 'rename', id: randomUUID() }),
          },
          {
            id: 'remove',
            label: 'Remove from Porcelain',
            destructive: true,
            onPress: () => setRequest({ kind: 'remove', id: randomUUID() }),
          },
        ]}
      />
      <BottomSheet
        isPresented={request !== undefined}
        onDismiss={close}
        contentPadding={0}
        snapPoints={['full']}
      >
        {request && (
          <ProjectActionForm
            key={request.id}
            kind={request.kind}
            project={project}
            connection={connection}
            onClose={close}
          />
        )}
      </BottomSheet>
    </>
  );
}

function ProjectActionForm({
  kind,
  connection,
  project,
  onClose,
}: {
  kind: 'rename' | 'remove';
  connection: RuntimeConnection;
  project: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const commands = useProjectActions(connection, project.id);
  const result =
    kind === 'rename' ? commands.renameResult : commands.removeResult;
  const failure = AsyncResult.isFailure<unknown, unknown>(result)
    ? connectionErrorMessage(Cause.squash(result.cause))
    : undefined;
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={4} paddingX={6} paddingY={8}>
          <Text variant="heading">
            {kind === 'rename'
              ? 'Rename project'
              : `Remove ${project.name} from Porcelain?`}
          </Text>
          {kind === 'rename' ? (
            <Field label="Name">
              <Input
                accessibilityLabel="Name"
                value={name}
                onChangeText={setName}
                disabled={result.waiting}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          ) : (
            <Text>
              The repository and its worktrees stay on this computer. You can
              add the project again later.
            </Text>
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
              disabled={result.waiting}
              onPress={onClose}
            />
            <Button
              label={kind === 'rename' ? 'Rename' : 'Remove from Porcelain'}
              variant={kind === 'rename' ? 'default' : 'destructive'}
              pending={result.waiting}
              disabled={kind === 'rename' && !name.trim()}
              onPress={() =>
                kind === 'rename'
                  ? commands.rename(name.trim(), onClose)
                  : commands.remove(onClose)
              }
            />
          </Box>
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
