export function startPath(
  state: 'loading' | 'failed' | 'unavailable' | 'none' | 'selected',
): '/worktrees' | '/walkthrough' | undefined {
  switch (state) {
    case 'loading':
      return undefined;
    case 'none':
      return '/worktrees';
    case 'failed':
    case 'unavailable':
    case 'selected':
      return '/walkthrough';
  }
}
