import { useSelectedWorktree } from '../../projects';

export type ReviewWorkspace = NonNullable<
  ReturnType<typeof useSelectedWorktree>
>;

export function useReviewWorkspace(key?: string) {
  const workspace = useSelectedWorktree();
  return key === undefined || workspace?.key === key ? workspace : undefined;
}
