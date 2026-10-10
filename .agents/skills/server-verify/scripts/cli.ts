import { Schema } from 'effect';
import { pairingLink } from '@porcelain/contracts/access';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ServerHandle } from '@porcelain/server/kit/isolated-server';
import {
  optionalDrivers,
  runCli,
  sandboxProblems,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import { connectionSchema } from '../../verify-core/connection.ts';
import {
  agentCommand,
  issuedLink,
  serverOptions,
  serverRead,
} from '../../verify-core/fixtures.ts';
import { registry } from './instance.ts';
import { serve, start } from './start.ts';

const usage = `Usage: .agents/skills/server-verify/scripts/cli <command> [--instance <id>]
  start                   build a disposable server and print its connection card
  doctor                  check startup dependencies and list optional drivers
  status                  inspect captured ownership, build staleness and connection metadata
  logs                    print redacted server output
  stop                    stop owned processes, remove private runtime data, keep evidence
  evidence                print the evidence folder (retained sessions require --instance)
  ids                     print deterministic fixture IDs and paths
  pairing-link            print a fresh one-time browser pairing link
  agent publish-review "<title>" [--context] [--summary-html <html>]
  agent publish-proof "<title>" --check "<name>=pass|fail|skipped" [--output "<name>=<text>"] --screenshot "<title>"
  agent comment <path> "<body>" | reply <threadId|latest> "<body>"
  server published-review | reviewed-files [<branch ref>] | reviewed-layers | comment-threads | project | devices | pending-links | receipt <requestId>
                          deterministic fixture actions and typed server readbacks
Drive HTTP/WebSocket, Git and files directly using connection.json and your own tools.
`;

async function doctor(requested: string | undefined): Promise<string> {
  const missing = sandboxProblems();
  const lines = [
    'Startup dependencies:',
    ...(missing.length > 0
      ? missing.map((problem) => `FAIL ${problem}`)
      : ['ready: Node, Git, ps and server sandbox']),
    'Optional drivers:',
    'Node fetch and WebSocket: built in',
    ...optionalDrivers(),
  ];
  if (missing.length > 0) process.exitCode = 1;
  if (missing.length > 0) return `${lines.join('\n')}\n`;
  if (requested !== undefined) {
    const status = await registry.status(requested);
    const instance = registry.chosen(requested, { includeStopped: true });
    const recorder = registry.redactor(instance).recorder();
    const handle = await ServerHandle.attach(instance.detail.manifestPath);
    const response = await handle
      .send(recorder, { method: 'GET', path: '/api/health', auth: 'none' })
      .catch(() => undefined);
    const healthy =
      response?.status === 200 &&
      response.headers['content-type']?.includes('application/json') === true;
    lines.push(
      JSON.stringify(status),
      `health JSON 200: ${healthy ? 'ready' : 'FAIL'}`,
    );
    if (!status.alive || status.stale !== null || !healthy)
      process.exitCode = 1;
    await registry
      .evidence(instance)
      .json('doctor', { status, healthy, missing }, recorder);
  } else {
    lines.push(
      `live instances: ${
        registry
          .list()
          .filter((entry) => entry.alive)
          .map((entry) => entry.instance.id)
          .join(', ') || 'none'
      }`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function stop(requested: string | undefined): Promise<string> {
  const result = await registry.stopById(requested);
  if (!result.alreadyStopped)
    await registry
      .evidence({ evidence: result.evidence, secrets: [] })
      .json('stop', {
        command: ['stop', '--instance', result.id],
        instance: result.id,
        complete: result.complete,
        report: result.report,
      });
  return stopOutput(result);
}

async function main(argv: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { ...serverOptions, instance: { type: 'string' } },
    allowPositionals: true,
  });
  const [command, ...rest] = positionals;
  if (command === 'start') return start();
  if (command === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (command === 'doctor') return doctor(values.instance);
  if (command === 'stop') return stop(values.instance);
  if (command === 'evidence')
    return `${registry.evidencePath(values.instance)}\n`;
  if (command === 'status')
    return `${JSON.stringify(await registry.status(values.instance), null, 2)}\n`;
  if (
    !['logs', 'ids', 'agent', 'server', 'pairing-link'].includes(command ?? '')
  )
    throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  if (command === 'logs')
    return registry
      .redactor(instance)
      .text(await readFile(instance.detail.logFile, 'utf8'));
  return registry.drive(instance, argv, async () => {
    const recorder = registry.redactor(instance).recorder();
    let output: string;
    if (command === 'agent')
      output = await agentCommand(
        instance.detail.manifestPath,
        rest,
        values,
        recorder,
      );
    else if (command === 'server')
      output = await serverRead(instance.detail.manifestPath, rest, recorder);
    else if (command === 'pairing-link') {
      const grant = await issuedLink(
        instance.detail.manifestPath,
        'Verification browser',
        false,
        recorder,
      );
      recorder.secret(grant.code);
      const link = pairingLink({
        addresses: [grant.address],
        code: grant.code,
        environmentId: grant.environmentId,
      });
      output = `${link}\n`;
    } else {
      if (instance.connectionPath === undefined)
        throw new Error('The server published no connection metadata');
      const connection = Schema.decodeUnknownSync(connectionSchema)(
        JSON.parse(await readFile(instance.connectionPath, 'utf8')),
      );
      output = `${JSON.stringify(connection.fixtures, null, 2)}\n`;
    }
    await registry
      .evidence(instance)
      .json(command ?? 'ids', { command: argv, output }, recorder);
    return registry.redactor(instance).known(output);
  });
}

await runCli(main);
