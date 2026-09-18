// Real projects are observed, never changed. Review data (comments, layers,
// reviewed marks, artifacts, preferences) lives in the lab's disposable state
// directory and stays writable; anything that could touch a repository,
// its remote, or an AI provider is refused before it reaches the server.
const blocked: [RegExp, string, (method: string) => boolean][] = [
  [
    /^\/projects\/[^/]+\/worktrees\/[^/]+\/git\/(commit|push|pull|fetch|stash)(\/|$|\?)/,
    'Git actions are disabled for real projects.',
    () => true,
  ],
  [
    /^\/projects\/[^/]+\/worktrees\/[^/]+\/git\/commit-draft(\?|$)/,
    'AI commit drafts would send real code to a provider.',
    () => true,
  ],
  [
    /^\/worktrees\/[^/]+\/files(\?|$)/,
    'File edits are disabled for real projects.',
    (method) => method !== 'GET',
  ],
];

export function readOnlyBlock(method: string, url: string) {
  const path = url.startsWith('/api/') ? url.slice(4) : url;
  for (const [pattern, reason, applies] of blocked)
    if (pattern.test(path) && applies(method.toUpperCase())) return reason;
  return undefined;
}
