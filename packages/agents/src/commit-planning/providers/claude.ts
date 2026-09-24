import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findExecutable } from '../commands/find-executable.ts';
import { runProvider } from '../commands/run-provider.ts';
import type { AgentLimits } from '../dtos/agent-limits.ts';
import type { AgentModel } from '../dtos/agent-model.ts';
import { ProviderNotInstalledError } from '../errors/provider-not-installed-error.ts';
import type { Provider } from '../interfaces/provider.ts';
import { claudeAnswer } from '../parsers/parse-provider-answer.ts';

export class ClaudeProvider implements Provider {
  private readonly limits: AgentLimits;

  constructor(limits: AgentLimits) {
    this.limits = limits;
  }

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
      const output = await runProvider(
        {
          command,
          args: [
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
          cwd: root,
          prompt,
          maxBytes: this.limits.claudeOutputBytes,
          timeoutMs: this.limits.processDeadlineMs,
          processGroup: this.limits.processGroup,
        },
        signal,
      );
      return claudeAnswer(output);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
