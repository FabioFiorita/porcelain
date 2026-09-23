import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { z } from 'zod';
import type { CommitModel } from '../models/commit-draft.ts';
import { CommitDraftError } from '../use-cases/errors/commit-draft-error.ts';
import type { CommitGenerator } from './interfaces/commit-generator.ts';

const proposalSchema = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        message: z.string().min(1).max(16384),
        paths: z.array(z.string().min(1).max(4096)).min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});
const outputSchema = JSON.stringify(z.toJSONSchema(proposalSchema));
const modelId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class CliCommitGenerator implements CommitGenerator {
  async models(signal: AbortSignal): Promise<CommitModel[]> {
    signal.throwIfAborted();
    const models: CommitModel[] = [];
    if (await executable('codex')) {
      const cache = join(
        process.env.CODEX_HOME ?? join(homedir(), '.codex'),
        'models_cache.json',
      );
      try {
        if ((await stat(cache)).size <= 1024 * 1024) {
          const parsed = z
            .object({
              models: z.array(
                z.object({
                  slug: z.string(),
                  display_name: z.string(),
                  visibility: z.string().optional(),
                }),
              ),
            })
            .parse(JSON.parse(await readFile(cache, 'utf8')));
          for (const model of parsed.models)
            if (model.visibility === 'list' && modelId.test(model.slug))
              models.push({
                id: `codex:${model.slug}`,
                label: model.display_name,
              });
        }
      } catch {
      }
    }
    if (await executable('claude'))
      models.push(
        { id: 'claude:sonnet', label: 'Sonnet' },
        { id: 'claude:haiku', label: 'Haiku' },
      );
    return models;
  }
  async generate(model: string, prompt: string, signal: AbortSignal) {
    const [provider, selected, extra] = model.split(':');
    if (
      !selected ||
      selected === 'default' ||
      extra !== undefined ||
      !modelId.test(selected) ||
      !['codex', 'claude'].includes(provider ?? '')
    )
      throw new CommitDraftError('Unsupported commit model.');
    const command = await executable(provider === 'codex' ? 'codex' : 'claude');
    if (!command)
      throw new CommitDraftError('The selected coding CLI is not installed.');
    const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-draft-'));
    try {
      let value: unknown;
      if (provider === 'codex') {
        const schemaPath = join(root, 'schema.json');
        const outputPath = join(root, 'result.json');
        await writeFile(schemaPath, outputSchema);
        await run(
          command,
          [
            'exec',
            '--ignore-user-config',
            '--ignore-rules',
            '--ephemeral',
            '--skip-git-repo-check',
            '--sandbox',
            'read-only',
            '--disable',
            'shell_tool',
            '--disable',
            'multi_agent',
            '--disable',
            'apps',
            '--disable',
            'plugins',
            '-c',
            'project_doc_max_bytes=0',
            '-c',
            'web_search="disabled"',
            '--output-schema',
            schemaPath,
            '--output-last-message',
            outputPath,
            '--model',
            selected,
            '-',
          ],
          root,
          prompt,
          signal,
        );
        value = JSON.parse(await readFile(outputPath, 'utf8'));
      } else {
        const output = await run(
          command,
          [
            '--print',
            '--safe-mode',
            '--restricted',
            '--tools',
            '',
            '--strict-mcp-config',
            '--no-session-persistence',
            '--output-format',
            'json',
            '--json-schema',
            outputSchema,
            '--model',
            selected,
          ],
          root,
          prompt,
          signal,
        );
        const response = z
          .object({ structured_output: z.unknown() })
          .parse(JSON.parse(output));
        value = response.structured_output;
      }
      return proposalSchema.parse(value).groups;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

async function executable(name: string) {
  for (const directory of (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)) {
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      if ((await stat(path)).isFile()) return path;
    } catch {
    }
  }
  return null;
}
async function run(
  command: string,
  args: string[],
  cwd: string,
  input: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stopGroup = () => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ESRCH')
      )
        child.kill('SIGKILL');
    }
  };
  const timer = setTimeout(stopGroup, 120000);
  signal.addEventListener('abort', stopGroup, { once: true });
  child.once('exit', stopGroup);
  child.stdin.on('error', () => {});
  try {
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let overflow = false;
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
          overflow = true;
          stopGroup();
        } else chunks.push(chunk);
      });
      child.stderr.resume();
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0 && !overflow)
          resolve(Buffer.concat(chunks).toString('utf8'));
        else reject(new Error('Generation process failed'));
      });
      child.stdin.end(input);
      if (signal.aborted) stopGroup();
    });
  } catch (cause) {
    signal.throwIfAborted();
    throw new CommitDraftError(
      'Commit generation failed. Check that the selected CLI is up to date and signed in.',
      { cause },
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stopGroup);
  }
}
