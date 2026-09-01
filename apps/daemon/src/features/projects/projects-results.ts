export type ProjectsOperationError =
  | { readonly code: 'projects.not-found' }
  | { readonly code: 'projects.not-a-directory' }
  | { readonly code: 'projects.unavailable' }
  | { readonly code: 'projects.dev-repo-forbidden' }
  | { readonly code: 'projects.overlay-target-invalid' }
  | { readonly code: 'git.not-a-repository' }
  | { readonly code: 'git.branch-already-exists' }
  | { readonly code: 'git.worktree-conflict' }
  | { readonly code: 'git.working-tree-conflict' }
  | { readonly code: 'canvas.not-found' }
  | { readonly code: 'canvas.unavailable' }

export type ProjectOperationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ProjectsOperationError }
