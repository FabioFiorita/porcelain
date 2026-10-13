import { WorkspaceMenu } from './workspace-menu';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function WorkspacePicker() {
  const { picker } = useWorkspacePickerModel();
  return <WorkspaceMenu {...picker} />;
}
