/** The one agent instruction shown in Settings → Personalization. */
export function profileLayersInstruction(workspacePath: string): string {
  return `## Porcelain story order

When work starts or changes shape in \`${workspacePath}\`, use \`porcelain_profile\` to keep this worktree's story layers aligned with the path the change actually travels through the repository.

Read both the project and worktree profiles before writing. Change only \`layers\`, using \`{ label, pattern }\` entries whose regular expressions match repository-relative paths. Show the proposed layer order and wait for confirmation before \`op: "set"\`. When the task is complete, restore inherited story order.`
}
