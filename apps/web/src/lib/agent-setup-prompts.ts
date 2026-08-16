/**
 * Copy-to-clipboard agent kickoff prompts for repo setup (flow layers + monorepo
 * scope). Same idiom as review-lifecycle prompts — paste into your coding agent;
 * never call navigator.clipboard here (use copyText at the call site).
 */

/** Unconfigured layers: agent inspects the tree and writes a full layers set. */
export function layersSetupPrompt(): string {
  return [
    'Configure Porcelain flow layers for this repository (porcelain-companion skill → layers).',
    'Layers are agent-managed for *this* tree — not a fixed React stack. Unconfigured repos start with Docs + Agents starters only; product code lands in Other until you set real groups.',
    '',
    '1. Inspect the repo layout: top-level dirs, package roots, tsconfig/project boundaries, existing README / AGENTS.md.',
    '2. Propose ordered layers entry-point → data (or docs/agents first if only those are dirty). Prefer a handful of meaningful groups; leave the long tail in Other.',
    '3. Replace the whole set (whole-set replace, not per-layer add):',
    "   porcelain layers set --layers - <<'JSON'",
    '   [',
    '     { "label": "…", "pattern": "…" }',
    '   ]',
    '   JSON',
    '4. Confirm with `porcelain layers get` and that Changes grouping looks right.',
    '',
    'Patterns match repo-relative paths. Furthest-right match wins. Examples: folder `(^|/)(routes|pages)/`, suffix `\\.(test|spec)\\.[a-z]+$`.',
    'Run from inside the repo (or pass --repo <absolute path>).',
  ].join('\n')
}
