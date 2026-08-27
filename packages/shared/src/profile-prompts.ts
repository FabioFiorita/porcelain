/** The one agent instruction shown in Settings → Personalization. */
export function profileLayersInstruction(workspacePath: string): string {
  return `## Porcelain review order

When work in \`${workspacePath}\` is ready for review, include that Review's complete \`layers\` array in the \`porcelain_canvas\` review template data. Each entry is \`{ label, pattern }\`, with a regular expression matched against repository-relative paths.

Layers describe only that Review's narrative. Do not read, write, or reuse a Worktree profile layer order.`
}
