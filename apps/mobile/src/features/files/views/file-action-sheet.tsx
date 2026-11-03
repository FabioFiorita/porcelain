import { useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Sheet } from '../../../components/ui/sheet';
import { WorkspaceGate, type Workspace } from '../../projects';
import { useEditFile, type FileAction } from '../commands/edit-file';

export function fileFormAction(params: {
  kind?: string;
  entryKind?: string;
  folder?: string;
  path?: string;
}): FileAction | undefined {
  if (params.kind === 'move' && params.path)
    return { kind: 'move', path: params.path };
  if (params.kind === 'create')
    return {
      kind: 'create',
      entryKind: params.entryKind === 'directory' ? 'directory' : 'file',
      folder: params.folder ?? '',
    };
  return undefined;
}

export function FileActionSheet({
  workspace,
  action,
  onClose,
  onCreated,
}: {
  workspace: string | undefined;
  action: FileAction | undefined;
  onClose: () => void;
  onCreated: (path: string, workspace: string) => void;
}) {
  return (
    <Sheet title={action ? actionTitle(action) : 'File'}>
      <WorkspaceGate
        title="Files"
        expectedWorkspace={workspace ?? ''}
        changed={
          <Empty
            title="Workspace changed"
            description="Another worktree is selected now. Open Files again from the worktree you want."
          />
        }
      >
        {(selected) =>
          action ? (
            <ActionForm
              selected={selected}
              action={action}
              onClose={onClose}
              onCreated={(path) => onCreated(path, selected.key)}
            />
          ) : (
            <Empty
              title="Action unavailable"
              description="Return to Files and choose the action again."
            />
          )
        }
      </WorkspaceGate>
    </Sheet>
  );
}

function ActionForm({
  selected,
  action,
  onClose,
  onCreated,
}: {
  selected: Workspace;
  action: FileAction;
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const [value, setValue] = useState(action.kind === 'move' ? action.path : '');
  const edit = useEditFile(selected.connection, selected.scope);
  return (
    <>
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
          accessibilityLabel={action.kind === 'move' ? 'New path' : 'Name'}
          value={value}
          onChangeText={setValue}
          disabled={edit.result.waiting}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
      {AsyncResult.isFailure(edit.result) ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(edit.result.cause))}
        />
      ) : null}
      <Button
        testID="file-action-submit"
        label={action.kind === 'move' ? 'Rename' : 'Create'}
        pending={edit.result.waiting}
        disabled={!value.trim()}
        onPress={() => edit.submit(action, value, onClose, onCreated)}
      />
    </>
  );
}

function actionTitle(action: FileAction) {
  if (action.kind === 'move') return 'Rename';
  if (action.entryKind === 'file') return 'New file';
  return 'New folder';
}
