import { Stack, useRouter, useSegments } from 'expo-router';
import { headerIcon } from '../../../shared/icons/header-icon';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function WorkspacePicker() {
  const { picker } = useWorkspacePickerModel();
  const router = useRouter();
  const [group] = useSegments();
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={headerIcon('workspace')}
        accessibilityLabel={picker.label}
        onPress={() => {
          switch (group) {
            case '(review)':
              router.push('/(review)/workspaces');
              break;
            case '(history)':
              router.push('/(history)/workspaces');
              break;
            default:
              router.push('/(files)/workspaces');
          }
        }}
      />
    </Stack.Toolbar>
  );
}
