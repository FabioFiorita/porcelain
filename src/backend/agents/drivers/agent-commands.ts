/**
 * Pure helpers for custom slash commands — the CLI-agnostic naming, description-parsing,
 * invocation-parsing, and template-expansion logic every driver shares. The impure
 * filesystem walk lives in the sibling `agent-commands-fs.ts`; everything here is a pure
 * string transform so it's unit-tested in isolation (agent-commands.test.ts).
 *
 * A command lives in a `.md` file (`.claude/commands/**`, `~/.codex/prompts`,
 * `.opencode/command`); its NAME is the file's path (minus `.md`) with directory segments
 * joined by `:` (Claude's namespacing convention). Its DESCRIPTION is the frontmatter
 * `description:` or, failing that, a leading markdown heading. EXPANSION substitutes the
 * command file's body for a leading `/name …` invocation, filling `$ARGUMENTS` / `$1..$9`.
 */

/** `foo/bar.md` → `foo:bar`; `hello.md` → `hello`. Separator-agnostic (posix or win). */
export function commandNameFromRelPath(relPath: string): string {
  return relPath
    .replace(/\.md$/i, '')
    .split(/[/\\]+/)
    .filter((segment) => segment !== '')
    .join(':')
}

/** Strip a leading `---`-fenced YAML frontmatter block (returns the body only). */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return match ? content.slice(match[0].length) : content
}

/**
 * A command's one-line description: the frontmatter `description:` if present, else a
 * leading markdown heading (`# …`). Anything else → undefined (no description).
 */
export function parseCommandDescription(content: string): string | undefined {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (frontmatter) {
    const line = frontmatter[1]
      .split(/\r?\n/)
      .find((candidate) => /^\s*description\s*:/i.test(candidate))
    if (line) {
      const value = line
        .replace(/^\s*description\s*:/i, '')
        .trim()
        .replace(/^["']|["']$/g, '')
      if (value !== '') return value
    }
  }
  for (const raw of stripFrontmatter(content).split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') continue
    // Only the FIRST non-empty content line counts, and only when it's a heading.
    if (!line.startsWith('#')) return undefined
    const text = line.replace(/^#+\s*/, '').trim()
    return text === '' ? undefined : text
  }
  return undefined
}

/** Split `/name the rest` into `{ name, args }`; null when the text isn't a slash call. */
export function parseSlashInvocation(text: string): { name: string; args: string } | null {
  const match = text.match(/^\/(\S+)[ \t]*([\s\S]*)$/)
  if (!match) return null
  return { name: match[1], args: match[2].trim() }
}

/**
 * Expand a command file into the prompt it stands for: drop its frontmatter, then fill
 * `$ARGUMENTS` with the whole argument string and `$1..$9` with the whitespace-split
 * positionals (an absent positional becomes empty). Used driver-side for the CLIs that
 * DON'T expand `/name` themselves.
 */
export function expandCommandTemplate(template: string, args: string): string {
  const positional = args.split(/\s+/).filter((token) => token !== '')
  return stripFrontmatter(template)
    .replace(/\$ARGUMENTS\b/g, args)
    .replace(/\$([1-9])\b/g, (_match, digit: string) => positional[Number(digit) - 1] ?? '')
    .trim()
}
