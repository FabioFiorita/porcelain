import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { findExecutable } from '../commands/find-executable.ts';
import { runProvider } from '../commands/run-provider.ts';
import type { AgentLimits } from '../dtos/agent-limits.ts';
import type { AgentModel } from '../dtos/agent-model.ts';
import { ProviderNotInstalledError } from '../errors/provider-not-installed-error.ts';
import type { Provider } from '../interfaces/provider.ts';
import { codexAnswer } from '../parsers/parse-provider-answer.ts';

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
  private readonly limits: AgentLimits;

  constructor(limits: AgentLimits) {
    this.limits = limits;
  }

  readonly name = 'codex';

  async models(signal?: AbortSignal): Promise<AgentModel[]> {
    signal?.throwIfAborted();
    if (!(await findExecutable('codex'))) return [];
    const cache = join(
      process.env.CODEX_HOME ?? join(homedir(), '.codex'),
      'models_cache.json',
    );
    try {
      if ((await stat(cache)).size > this.limits.codexCacheBytes) return [];
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
      await runProvider(
        {
          command,
          args: [
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
          cwd: root,
          prompt,
          maxBytes: this.limits.codexOutputBytes,
          timeoutMs: this.limits.processDeadlineMs,
        },
        signal,
      );
      return codexAnswer(await readFile(outputPath, 'utf8'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
