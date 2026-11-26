import { ReviewPane } from '../features/workspace/index';
import type { ListDetailMode } from '../shared/rules/list-detail';

export function WorktreeChangesPane({
  workspace,
  mode,
}: {
  workspace?: string | undefined;
  mode?: ListDetailMode | undefined;
}) {
  return <ReviewPane workspace={workspace} mode={mode} />;
}
