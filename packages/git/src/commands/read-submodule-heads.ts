import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';

/**
 * The commit each named submodule currently has checked out.
 *
 * A submodule's working side is a directory, so nothing on the filesystem can
 * digest it, and the status prints only the HEAD and index gitlinks — which
 * are equal exactly when the pointer has moved in the worktree. Without this
 * an unstaged pointer move would be permanently unmarkable.
 *
 * It runs in the parent checkout and reads only where each submodule points.
 * What changed inside a submodule stays outside the parent's review.
 */
export async function readSubmoduleHeads(
  session: CheckoutSession,
  paths: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths)];
  const heads = new Map<string, string>();
  if (wanted.length === 0) return heads;
  const output = await runInspection(
    session.path,
    ['submodule', 'status', '--', ...wanted],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  for (const line of output.toString('utf8').split('\n')) {
    // ` <oid> <path>` or `+<oid> <path> (<describe>)`. The path is matched
    // against the ones asked for rather than parsed out of the line, so a
    // submodule whose name contains " (" cannot be read as another one.
    const match = /^[ +\-U]?([0-9a-f]{40,64}) (.*)$/.exec(line);
    const oid = match?.[1];
    const rest = match?.[2];
    if (oid === undefined || rest === undefined) continue;
    const path = wanted.find(
      (candidate) => rest === candidate || rest.startsWith(`${candidate} (`),
    );
    // A leading `-` means the submodule is not checked out, so there is no
    // working commit to speak of and the pointer stays unestablished.
    if (path !== undefined && !line.startsWith('-')) heads.set(path, oid);
  }
  return heads;
}
