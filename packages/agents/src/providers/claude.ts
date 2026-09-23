import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentModel } from '../models/agent-model.ts';
import { findExecutable, runCommandLine } from './command-line.ts';
import type { Provider } from './provider.ts';
import { ProviderNotInstalledError } from './provider-not-installed-error.ts';

const envelopeSchema = z.object({ structured_output: z.unknown() });

export class ClaudeProvider implements Provider {
  readonly name = 'claude';

  async models(signal?: AbortSignal): Promise<AgentModel[]> {
    signal?.throwIfAborted();
    if (!(await findExecutable('claude'))) return [];
    return [
      { id: 'claude:sonnet', label: 'Sonnet' },
      { id: 'claude:haiku', label: 'Haiku' },
    ];
  }

  async answer(
    model: string,
    prompt: string,
    outputSchema: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const command = await findExecutable('claude');
    if (!command) throw new ProviderNotInstalledError();
    const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-draft-'));
    try {
      const output = await runCommandLine(
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
          model,
        ],
        root,
        prompt,
        signal,
      );
      return envelopeSchema.parse(JSON.parse(output)).structured_output;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
