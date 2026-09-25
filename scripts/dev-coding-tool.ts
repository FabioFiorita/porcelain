import { readFileSync } from 'node:fs';

type Group = { message: string; paths: string[] };
type Answer = { stdout: string; stderr: string; exitCode: number };

const readme: Group = {
  message: 'Explain the change to review in the README',
  paths: ['README.md'],
};

export const codingTool = {
  command: 'claude',
  message: readme,
  groups: [
    readme,
    { message: 'Add notes for the reviewer', paths: ['NOTES.md'] },
  ],
};

const servedModels = new Set(['sonnet', 'haiku']);
const switches = new Set([
  '--print',
  '--safe-mode',
  '--restricted',
  '--strict-mcp-config',
  '--no-session-persistence',
]);
const valued = new Set([
  '--tools',
  '--output-format',
  '--json-schema',
  '--model',
]);

function refused(reason: string): Answer {
  return { stdout: '', stderr: `${reason}\n`, exitCode: 1 };
}

function isSchema(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function answerPrompt(args: readonly string[], prompt: string): Answer {
  const given = new Set<string>();
  const values = new Map<string, string>();
  for (let at = 0; at < args.length; at += 1) {
    const name = args[at] ?? '';
    const value = args[at + 1];
    if (switches.has(name)) given.add(name);
    else if (valued.has(name) && value !== undefined) {
      values.set(name, value);
      at += 1;
    } else return refused(`error: unknown option '${name}'`);
  }
  const model = values.get('--model') ?? '';
  if (!given.has('--print'))
    return refused('error: the fake coding tool answers only in print mode');
  if (values.get('--output-format') !== 'json')
    return refused('error: the fake coding tool answers only in JSON');
  if (!isSchema(values.get('--json-schema') ?? ''))
    return refused('error: --json-schema is not a JSON schema');
  if (!servedModels.has(model))
    return refused(
      `There's an issue with the selected model (${model}). It may not exist or you may not have access to it.`,
    );
  const firstLine = prompt.split('\n', 1)[0] ?? '';
  const plan = firstLine.startsWith('Write exactly one ')
    ? { groups: [codingTool.message] }
    : firstLine.startsWith('Write a small sequence ')
      ? { groups: codingTool.groups }
      : undefined;
  if (plan === undefined)
    return refused('error: the fake coding tool drafts commits only');
  return {
    stdout: `${JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      num_turns: 1,
      result: JSON.stringify(plan),
      structured_output: plan,
    })}\n`,
    stderr: '',
    exitCode: 0,
  };
}

export function runCodingTool(): void {
  const answer = answerPrompt(process.argv.slice(2), readFileSync(0, 'utf8'));
  process.stdout.write(answer.stdout);
  process.stderr.write(answer.stderr);
  process.exitCode = answer.exitCode;
}
