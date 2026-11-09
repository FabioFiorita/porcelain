import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function readReviewPatch(
  input: { remote: string; baseSha: string; headSha: string },
  readHostedPatch: () => string,
): string | undefined {
  try {
    return readHostedPatch();
  } catch {
    console.log(
      'GitHub could not serve the patch; reading the exact commits with Git',
    );
  }
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-review-patch-'));
  const git = (args: readonly string[]) =>
    execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: 'pipe',
    });
  try {
    git(['init', '--bare', '--quiet']);
    git(['remote', 'add', 'origin', input.remote]);
    git([
      'fetch',
      '--quiet',
      '--no-tags',
      '--filter=blob:none',
      'origin',
      input.baseSha,
      input.headSha,
    ]);
    return git([
      'diff',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      `${input.baseSha}...${input.headSha}`,
      '--',
    ]);
  } catch {
    return undefined;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
