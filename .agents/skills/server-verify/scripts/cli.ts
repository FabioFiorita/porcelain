import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
import {
  type Recorder,
  ServerHandle,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  runCli,
  sandboxProblems,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import { connection } from './connection.ts';
import { registry, STALE_BUILD, type ServerInstance } from './instance.ts';
import { record, type RecordInput } from './record.ts';
import { serve, start } from './start.ts';

const usage = `Usage: .agents/skills/server-verify/scripts/cli <command> [--instance <id>]
  start                                   build and start one disposable sandboxed server
  connection                              print public metadata and protected curl configuration paths
  doctor                                  check ownership, health and whether the build matches the checkout
  record <label> --body <file> [--headers <file>] [--status N]
                 [--request <description>] [--transport network|owner]
  record <label> --transcript <file> [--request <description>] [--transport network|owner]
                                          import a capture as redacted evidence; never assert
  evidence                                print the retained evidence folder
  logs                                    print redacted server output
  stop                                    stop the owned instance, remove runtime data and keep evidence
`;

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const [, value] = args.splice(at, 2);
  if (value === undefined || value.startsWith('--'))
    throw new Usage(`${name} takes a value`);
  return value;
}

function answering(address: string): Promise<boolean> {
  const { hostname, port } = new URL(address);
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port) });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function finish(
  instance: ServerInstance,
  name: string,
  recorder: Recorder,
  record: Record<string, unknown>,
) {
  const file = await registry.evidence(instance).json(name, record, recorder);
  process.stderr.write(`evidence: ${file}\n`);
}

async function doctor(
  requested: string | undefined,
  argv: readonly string[],
): Promise<string> {
  const started = performance.now();
  const missing = sandboxProblems();
  const instance = registry.chosen(requested);
  const recorder = registry.redactor(instance).recorder();
  const handle = await ServerHandle.attach(instance.detail.manifestPath);
  const health = await handle
    .send(recorder, { method: 'GET', path: '/api/health', auth: 'none' })
    .then((response) => response.status)
    .catch(() => 0);
  const checks = [
    {
      check: 'the instance process is the one start started',
      ok: registry.alive(instance),
    },
    {
      check: `the port answers at ${instance.detail.address}`,
      ok: await answering(instance.detail.address),
    },
    { check: 'the health route answers 200', ok: health === 200 },
    {
      check: 'the build matches the checkout',
      ok: registry.fingerprint() === instance.fingerprint,
    },
  ];
  await finish(instance, 'doctor', recorder, {
    command: argv,
    durationMs: Math.round(performance.now() - started),
    missing,
    checks,
    steps: recorder.steps,
  });
  if (missing.length > 0 || checks.some((entry) => !entry.ok))
    process.exitCode = 1;
  return [
    ...missing.map((problem) => `FAIL ${problem}`),
    ...checks.map(
      ({ check, ok }) =>
        `${ok ? 'ok  ' : 'FAIL'} ${check}${ok || !check.startsWith('the build') ? '' : `: ${STALE_BUILD}`}`,
    ),
    '',
  ].join('\n');
}

async function stop(requested: string | undefined): Promise<string> {
  const started = performance.now();
  const result = await registry.stopById(requested);
  if (!result.alreadyStopped) {
    const file = await registry
      .evidence({ evidence: result.evidence, secrets: [] })
      .json('stop', {
        command: ['stop', '--instance', result.id],
        durationMs: Math.round(performance.now() - started),
        instance: result.id,
        complete: result.complete,
        report: result.report,
      });
    process.stderr.write(`evidence: ${file}\n`);
  }
  return stopOutput(result);
}

function recordInput(args: string[]): RecordInput {
  const input: RecordInput = {};
  const body = option(args, '--body');
  const headers = option(args, '--headers');
  const transcript = option(args, '--transcript');
  const request = option(args, '--request');
  const status = option(args, '--status');
  const transport = option(args, '--transport');
  if (body !== undefined) input.body = body;
  if (headers !== undefined) input.headers = headers;
  if (transcript !== undefined) input.transcript = transcript;
  if (request !== undefined) input.request = request;
  if (status !== undefined) input.status = Number(status);
  if (transport !== undefined) {
    if (transport !== 'network' && transport !== 'owner')
      throw new Usage('record transport must be network or owner');
    input.transport = transport;
  }
  return input;
}

async function main(argv: readonly string[]): Promise<string> {
  const args = [...argv];
  const requested = option(args, '--instance');
  const [command, ...rest] = args;
  if (command === 'start') return start();
  if (command === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (command === 'evidence') return `${registry.evidencePath(requested)}\n`;
  if (command === 'logs') {
    const instance = registry.chosen(requested);
    return registry
      .redactor(instance)
      .text(await readFile(instance.detail.logFile, 'utf8'));
  }
  if (command === 'connection') return connection(registry.chosen(requested));
  if (command === 'doctor') return doctor(requested, argv);
  if (command === 'stop') return stop(requested);
  if (command === 'record') {
    const input = recordInput(rest);
    const [label, ...extra] = rest;
    if (label === undefined || extra.length > 0 || label.startsWith('--'))
      throw new Usage(
        'record takes one label and capture flags; run cli for usage',
      );
    return record(registry.chosen(requested), label, input);
  }
  throw new Usage(usage);
}

await runCli(main);
