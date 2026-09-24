import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const outputSchema = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    groups: {
      minItems: 1,
      maxItems: 20,
      type: 'array',
      items: {
        type: 'object',
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 16384 },
          paths: {
            minItems: 1,
            maxItems: 2000,
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 4096 },
          },
        },
        required: ['message', 'paths'],
        additionalProperties: false,
      },
    },
  },
  required: ['groups'],
  additionalProperties: false,
});
const PROMPT =
  'Write exactly one commit message for the changed path README.md, whose patch adds the line "Hello". Answer only with the JSON the schema describes: one group holding that message and the path README.md.';

function write(name: string, text: string): void {
  writeFileSync(join(here, name), text.endsWith('\n') ? text : `${text}\n`);
}

function captureClaude(root: string): void {
  const output = execFileSync(
    'claude',
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
      'haiku',
    ],
    { cwd: root, input: PROMPT, encoding: 'utf8' },
  );
  write('claude-answer.json', output);
  const envelope: unknown = JSON.parse(output, (key, value: unknown) =>
    key === 'structured_output' ? undefined : value,
  );
  write(
    'claude-answer-without-structured-output-hand-edited.json',
    JSON.stringify(envelope),
  );
}

function captureCodex(root: string): void {
  const schemaPath = join(root, 'schema.json');
  const outputPath = join(root, 'result.json');
  writeFileSync(schemaPath, outputSchema);
  execFileSync(
    'codex',
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
      'gpt-5.6-luna',
      '-',
    ],
    { cwd: root, input: PROMPT, encoding: 'utf8' },
  );
  write('codex-answer.json', readFileSync(outputPath, 'utf8'));
}

const root = mkdtempSync(join(tmpdir(), 'porcelain-agents-capture-'));
try {
  captureClaude(root);
  captureCodex(root);
} finally {
  rmSync(root, { recursive: true, force: true });
}
