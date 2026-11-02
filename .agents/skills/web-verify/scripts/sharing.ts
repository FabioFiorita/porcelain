import { Schema } from 'effect';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Refusal } from '../../verify-core/cli.ts';
import { repositoryRoot } from '../../verify-core/registry.ts';

const resultSchema = Schema.Struct({
  status: Schema.Literals(['protected', 'local-only']),
  publicUrl: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
});

export function sharing(
  command: 'start' | 'status' | 'stop',
  folder: string,
  localUrl: string,
): string {
  const marker = join(folder, 'sharing-helper');
  const helper = existsSync(marker)
    ? readFileSync(marker, 'utf8')
    : process.env.DEVELOPMENT_PREVIEW_HELPER;
  if (command === 'stop' && !existsSync(marker)) return '';
  if (!helper)
    throw new Refusal(
      'local-only: set DEVELOPMENT_PREVIEW_HELPER to a protected preview executable before preparing a developer preview.',
    );
  if (command === 'start') writeFileSync(marker, helper, { mode: 0o600 });
  const result = spawnSync(
    helper,
    [
      command,
      '--state-dir',
      join(folder, 'sharing'),
      '--owner',
      repositoryRoot,
      ...(command === 'start' ? ['--url', localUrl] : []),
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
  if (command === 'stop') {
    if (result.status !== 0)
      throw new Refusal(
        'Preview sharing cleanup failed; keep instance ownership state and inspect the helper.',
      );
    return '';
  }
  if (result.error)
    throw new Refusal(
      `local-only: protected sharing could not run: ${result.error.message}`,
    );
  let answer: typeof resultSchema.Type;
  try {
    answer = Schema.decodeUnknownSync(resultSchema)(JSON.parse(result.stdout));
  } catch {
    throw new Refusal(
      'local-only: protected sharing returned no valid protection result.',
    );
  }
  const url =
    answer.publicUrl === undefined ? null : URL.parse(answer.publicUrl);
  if (
    result.status !== 0 ||
    answer.status !== 'protected' ||
    url?.protocol !== 'https:'
  )
    throw new Refusal(
      `local-only: ${answer.reason ?? 'external protection was not verified'}`,
    );
  writeFileSync(join(folder, 'public-origin'), url.origin, { mode: 0o600 });
  return `developer preview ${url.origin}\nprotection verified; sign in as preview with the saved preview password in your own browser. Browser sessions are independent.\n`;
}
