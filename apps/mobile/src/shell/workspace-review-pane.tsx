import { ReviewPane } from '../features/workspace/index';

export function WorktreeChangesPane({
  workspace,
}: {
  workspace?: string | undefined;
}) {
  return <ReviewPane workspace={workspace} />;
}
