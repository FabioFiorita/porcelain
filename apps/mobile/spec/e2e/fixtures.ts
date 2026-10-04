import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { freemem, loadavg } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { inject, test as base } from 'vitest';
import type { Recorder } from '@porcelain/server/kit/isolated-server';
import {
  buildProblem,
  developmentClient,
  developmentLaunchUrl,
  identity,
  screenLink,
} from '../kit/development-client.ts';
import { Environment } from '../kit/environment.ts';
import { resetApp } from '../kit/simulator.ts';

export { expect } from 'vitest';

const execute = promisify(execFile);
const flows = import.meta.dirname;
const maestroLimitMs = 10 * 60 * 1000;
const textEvidence = /\.(?:log|json|xml|txt|html|yaml)$/;
const pairingLabel = 'Native mobile proof';

async function scrubFolder(folder: string, scrub: (text: string) => string) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await scrubFolder(path, scrub);
    else if (textEvidence.test(entry.name))
      await writeFile(path, scrub(await readFile(path, 'utf8')));
  }
}

export type FlowResult = { name: string; status: 'passed' | 'failed' };

function reportOf(xml: string): FlowResult {
  const name = /<testcase\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1];
  if (name === undefined) throw new Error('The Maestro report names no flow.');
  return {
    name: name.replaceAll('&apos;', "'").replaceAll('&amp;', '&'),
    status: /<(?:failure|error)\b/.test(xml) ? 'failed' : 'passed',
  };
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export const test = base
  .extend('device', { scope: 'worker' }, () => inject('mobileDevice'))
  .extend('serverBuild', { scope: 'worker' }, () => inject('mobileServerBuild'))
  .extend('recorders', (): Recorder[] => [])
  .extend('evidence', async ({ device, task }) => {
    const folder = join(device.evidence, slug(task.name));
    await mkdir(folder, { recursive: true });
    return folder;
  })
  .extend(
    'environments',
    ({ serverBuild, recorders, evidence }, { onCleanup }) => {
      const started: Environment[] = [];
      onCleanup(async () => {
        const failures = [];
        for (const environment of started) {
          const failure = await environment.stop();
          if (failure) failures.push(failure);
        }
        if (failures.length > 0) throw new Error(failures.join('; '));
      });
      return {
        async start(title: string, options: { workspace?: boolean } = {}) {
          const began = Date.now();
          const load = loadavg();
          let output = '';
          try {
            const environment = await Environment.start({
              build: serverBuild,
              title,
              label: pairingLabel,
              workspace: options.workspace ?? false,
              onOutput: (text) => {
                output = (output + text).slice(-16 * 1024);
              },
            });
            started.push(environment);
            recorders.push(environment.recorder);
            return environment;
          } finally {
            await writeFile(
              join(evidence, `environment-${title.toLowerCase()}.log`),
              recorders.reduce(
                (text, recorder) => recorder.scrub(text),
                `${new Date(began).toISOString()}: startup ${Date.now() - began}ms; load ${load.join(',')} -> ${loadavg().join(',')}; free memory ${freemem()} bytes\n${output}`,
              ),
            );
          }
        },
      };
    },
  )
  .extend('app', async ({ device, evidence, recorders }) => {
    const client = developmentClient();
    if (client === undefined) throw new Error(buildProblem());
    await resetApp(device.udid, client, identity.bundleIdentifier);
    const scrub = (text: string) =>
      recorders.reduce((scrubbed, recorder) => recorder.scrub(scrubbed), text);
    let runs = 0;
    return {
      async run(
        flow: string,
        variables: Record<string, string> = {},
      ): Promise<FlowResult> {
        runs += 1;
        const output = join(
          evidence,
          `${String(runs).padStart(2, '0')}-${flow.replace(/\.yaml$/, '')}`,
        );
        await mkdir(output, { recursive: true });
        const environment = {
          DEVELOPMENT_URL: developmentLaunchUrl(device.metro),
          ...variables,
        };
        try {
          const result = await execute(
            'maestro',
            [
              '--udid',
              device.udid,
              'test',
              join(flows, flow),
              '--test-output-dir',
              output,
              '--no-ansi',
              '--format',
              'junit',
              '--output',
              join(output, 'report.xml'),
              ...Object.entries(environment).flatMap(([name, value]) => [
                '-e',
                `${name}=${value}`,
              ]),
            ],
            {
              maxBuffer: 16 * 1024 * 1024,
              timeout: maestroLimitMs,
              env: {
                ...process.env,
                MAESTRO_CLI_NO_ANALYTICS: '1',
                MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
              },
            },
          );
          await writeFile(
            join(output, 'maestro.log'),
            scrub(result.stdout + result.stderr),
          );
        } catch (error) {
          const stdout: unknown =
            error instanceof Error ? Reflect.get(error, 'stdout') : undefined;
          const stderr: unknown =
            error instanceof Error ? Reflect.get(error, 'stderr') : undefined;
          const log = scrub(
            `${typeof stdout === 'string' ? stdout : ''}${typeof stderr === 'string' ? stderr : ''}`,
          );
          await writeFile(join(output, 'maestro.log'), log);
          await scrubFolder(output, scrub);
          throw new Error(
            `Maestro failed ${flow}; evidence in ${output}\n${log.split('\n').slice(-30).join('\n')}`,
          );
        }
        await scrubFolder(output, scrub);
        return reportOf(await readFile(join(output, 'report.xml'), 'utf8'));
      },
      link: screenLink,
    };
  });
