import type { ReactNode } from 'react';
import type { Workspace, WorktreeGuide } from '../../projects/index';
import { useWorktreeGuide } from '../queries/walkthrough';

export function WalkthroughGuide({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: (guide: WorktreeGuide) => ReactNode;
}) {
  return children(useWorktreeGuide(workspace));
}
