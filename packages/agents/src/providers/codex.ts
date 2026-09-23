import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentModel } from '../models/agent-model.ts';
import { findExecutable, runCommandLine } from './command-line.ts';
import type { Provider } from './provider.ts';
import { ProviderNotInstalledError } from './provider-not-installed-error.ts';

const MAX_CACHE_BYTES = 1024 * 1024;
const modelSlug = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const modelCacheSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      display_name: z.string(),
      visibility: z.string().optional(),
    }),
  ),
});

export class CodexProvider implements Provider {
  readonly name = 'codex';

  async models(signal?: AbortSignal): Promise<AgentModel[]> {
    signal?.throwIfAborted();
    if (!(await findExecutable('codex'))) return [];
    const cache = join(
      process.env.CODEX_HOME ?? join(homedir(), '.codex'),
      'models_cache.json',
    );
    try {
      if ((await stat(cache)).size > MAX_CACHE_BYTES) return [];
      const listed = modelCacheSchema.parse(
        JSON.parse(await readFile(cache, 'utf8')),
      );
      return listed.models
        .filter(
          (model) => model.visibility === 'list' && modelSlug.test(model.slug),
        )
        .map((model) => ({
          id: `codex:${model.slug}`,
          label: model.display_name,
        }));
    } catch {
      return [];
    }
  }

  async answer(
    model: string,
    prompt: string,
    outputSchema: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const command = await findExecutable('codex');
    if (!command) throw new ProviderNotInstalledError();
    const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-draft-'));
    try {
      const schemaPath = join(root, 'schema.json');
      const outputPath = join(root, 'result.json');
      await writeFile(schemaPath, outputSchema);
      await runCommandLine(
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
          model,
          '-',
        ],
        root,
        prompt,
        signal,
      );
      return JSON.parse(await readFile(outputPath, 'utf8'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
