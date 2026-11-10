import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const WALKTHROUGH_SCENARIO = 'porcelain-fake-walkthrough';
const WALKTHROUGH_RANGE = 'porcelain-fake-walkthrough-range';

function git(...args: readonly string[]): string {
  return execFileSync('git', [...args], { encoding: 'utf8' }).trim();
}

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function changedFiles(range: string): string[] {
  return git('diff', '--name-only', range).split('\n').filter(Boolean);
}

function walkthroughContent(range: string, outcome: string) {
  if (outcome === 'nothing')
    return {
      outcome: 'nothing',
      title: 'A small routine change',
      summary: 'Nothing here needs a reader.',
      growth: [],
      stops: [],
      onlyInTranscript: [],
      stillUnclear: [],
      checks: null,
    };
  const files = changedFiles(range);
  return {
    outcome: 'needs_you',
    title: 'Teach the sample to explain itself',
    summary:
      'The sample now carries `notes` beside its code, so a reader sees why.',
    growth: [
      { change: 'added', what: 'Notes', note: 'The reader sees them first.' },
      { change: 'changed', what: 'Readme', note: 'It links the notes.' },
      { change: 'removed', what: 'Old hint', note: 'Nothing used it.' },
      { change: 'added', what: 'Glossary', note: 'Terms live in one place.' },
      { change: 'added', what: 'Changelog', note: 'Kept by hand for now.' },
    ],
    stops: files.map((path, index) => ({
      title: `Step about \`${path}\``,
      explanation: 'A file changed here, and this explains why it did.',
      attention:
        index === 0
          ? {
              kind: 'product',
              note: 'Either choice ships; only the owner can pick.',
              question: 'Should `notes` stay in the sample?',
            }
          : null,
      excerpts: [],
      evidence: [],
      files: [{ path, note: 'Changed' }],
    })),
    onlyInTranscript: [
      { point: 'Why notes exist.', answer: 'The owner asked for them.' },
      { point: 'Why by hand.', answer: 'Tooling can wait.' },
      { point: 'Why now.', answer: 'A release needs them.' },
    ],
    stillUnclear: ['Whether the notes should move.', 'Who updates them.'],
    checks: null,
  };
}

function answerWalkthrough(args: readonly string[], prompt: string): Answer {
  const common = resolve(git('rev-parse', '--git-common-dir'));
  const scenarioPath = resolve(common, WALKTHROUGH_SCENARIO);
  const rangePath = resolve(common, WALKTHROUGH_RANGE);
  const first = prompt.startsWith('You did not build');
  if (first)
    writeFileSync(rangePath, /Only the range (\S+)/.exec(prompt)?.[1] ?? '');
  while (
    existsSync(scenarioPath) &&
    readFileSync(scenarioPath, 'utf8').trim() === 'hold'
  )
    pause(100);
  const scenario = existsSync(scenarioPath)
    ? readFileSync(scenarioPath, 'utf8').trim()
    : 'ready';
  if (scenario === 'signed-out')
    return refused('Not logged in. Please run claude auth login.');
  if (scenario === 'broken')
    return { stdout: 'not json', stderr: '', exitCode: 0 };
  const sessionId =
    args[args.indexOf(first ? '--session-id' : '--resume') + 1] ?? '';
  const answer = first
    ? { understood: 'A change to the sample.', could_not_tell: [] }
    : walkthroughContent(readFileSync(rangePath, 'utf8').trim(), scenario);
  return {
    stdout: `${JSON.stringify({
      type: 'result',
      is_error: false,
      session_id: sessionId,
      total_cost_usd: 0.01,
      structured_output: answer,
    })}\n`,
    stderr: '',
    exitCode: 0,
  };
}

export function runCodingTool(): void {
  const args = process.argv.slice(2);
  if (args[0] === 'auth' && args[1] === 'status') {
    process.stdout.write(JSON.stringify({ loggedIn: true }));
    return;
  }
  const prompt = readFileSync(0, 'utf8');
  const answer =
    args[0] === '-p'
      ? answerWalkthrough(args, prompt)
      : answerPrompt(args, prompt);
  process.stdout.write(answer.stdout);
  process.stderr.write(answer.stderr);
  process.exitCode = answer.exitCode;
}
