export function unownedProse(path: string): boolean {
  return (
    /\.(?:md|mdx|markdown)$/i.test(path) &&
    path !== 'AGENTS.md' &&
    path !== '.github/PULL_REQUEST_TEMPLATE.md' &&
    !path.startsWith('.agents/skills/')
  );
}
