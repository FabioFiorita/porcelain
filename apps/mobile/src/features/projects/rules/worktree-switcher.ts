import { worktreeSections, type WorktreeSection } from './worktree-section';

export type PhoneBarButton<Action> =
  | { kind: 'current'; section: WorktreeSection }
  | {
      kind: 'menu';
      destinations: readonly WorktreeSection[];
      actions: readonly Action[];
    };

export function phoneTopBar<Action>(
  section: WorktreeSection | undefined,
  pageActions: readonly Action[],
): PhoneBarButton<Action>[] {
  const menu: PhoneBarButton<Action> = {
    kind: 'menu',
    destinations: worktreeSections
      .map((entry) => entry.id)
      .filter((id) => id !== section),
    actions: pageActions,
  };
  return section ? [{ kind: 'current', section }, menu] : [menu];
}
