import { Box } from '../../../components/ui/box';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { BottomSheet, RNHostView } from '@expo/ui';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { Text } from '../../../components/ui/text';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { useSelectedWorktree } from '../../projects';
import { useEditFile, type FileAction } from '../commands/edit-file';

export function FileActionSheet({
  action,
  onClose,
  onCreated,
}: {
  action: FileAction | undefined;
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const selected = useSelectedWorktree();
  return (
    <BottomSheet
      isPresented={action !== undefined}
      onDismiss={onClose}
      contentPadding={0}
      snapPoints={['full']}
    >
      {action && selected ? (
        <ActionForm
          key={JSON.stringify([selected.key, action])}
          selected={selected}
          action={action}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </BottomSheet>
  );
}

function ActionForm({
  selected,
  action,
  onClose,
  onCreated,
}: {
  selected: NonNullable<ReturnType<typeof useSelectedWorktree>>;
  action: FileAction;
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const [value, setValue] = useState(action.kind === 'move' ? action.path : '');
  const edit = useEditFile(selected.connection, selected.scope);
  const title = (() => {
    if (action.kind === 'trash') {
      return 'Move to trash?';
    }
    if (action.kind === 'move') {
      return 'Rename';
    }
    if (action.entryKind === 'file') {
      return 'New file';
    }
    return 'New folder';
  })();
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={4} paddingX={6} paddingY={8}>
          <Text variant="heading">{title}</Text>
          {action.kind === 'trash' ? (
            <Text>
              Move {action.path} to the server's trash? This changes your
              worktree. You can restore it from the computer's system trash.
            </Text>
          ) : (
            <Field
              label={action.kind === 'move' ? 'New path' : 'Name'}
              description={
                action.kind === 'create'
                  ? `Create in ${action.folder || 'the worktree root'}.`
                  : 'Rename or move within this worktree.'
              }
            >
              <Input
                testID="file-action-path"
                accessibilityLabel={
                  action.kind === 'move' ? 'New path' : 'Name'
                }
                value={value}
                onChangeText={setValue}
                disabled={edit.result.waiting}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          )}
          {AsyncResult.isFailure(edit.result) ? (
            <ErrorState
              message={fileErrorMessage(Cause.squash(edit.result.cause))}
            />
          ) : null}
          <Button
            testID="file-action-submit"
            label={(() => {
              if (action.kind === 'trash') {
                return 'Move to trash';
              }
              if (action.kind === 'move') {
                return 'Rename';
              }
              return 'Create';
            })()}
            variant={action.kind === 'trash' ? 'destructive' : 'default'}
            pending={edit.result.waiting}
            disabled={action.kind !== 'trash' && !value.trim()}
            onPress={() => edit.submit(action, value, onClose, onCreated)}
          />
          <Button
            label="Cancel"
            variant="ghost"
            disabled={edit.result.waiting}
            onPress={onClose}
          />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
