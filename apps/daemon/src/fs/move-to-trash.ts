import trashImport from 'trash'

type Trash = (input: string | readonly string[]) => Promise<unknown>

/**
 * CJS `require("trash")` on this pure-ESM package yields `{ default: fn }`. esbuild's
 * `__toESM(..., 1)` then sets `.default` to that whole object, so a bare
 * `import trash from 'trash'` is not callable at runtime in the daemon bundle.
 * Normalize either shape (function or `{ default: function }`) once here.
 */
function asTrash(mod: unknown): Trash {
  if (typeof mod === 'function') return mod as Trash
  if (mod !== null && typeof mod === 'object' && 'default' in mod) {
    const inner = (mod as { default: unknown }).default
    if (typeof inner === 'function') return inner as Trash
  }
  throw new Error('trash package export is not callable')
}

const trash = asTrash(trashImport)

/** Move a path to the OS trash (recoverable). Daemon-side only. */
export async function moveToTrash(path: string): Promise<void> {
  await trash(path)
}
