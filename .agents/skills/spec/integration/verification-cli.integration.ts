import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { list, record, text } from '@porcelain/server/kit/session';
import {
  repositoryRoot,
  WEB_CLI,
  WEB_CASE_MS,
  cli,
  started,
  evidenceOf,
  printed,
} from './verification-cli.ts';

test(
  'the web CLI publishes a browser-free connection card and a fresh pairing link, then stops its server and Vite',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    expect(instance.run.stdout).toContain('\nconnection ');
    const [, connectionPath = ''] =
      /\nconnection (\S+)\n/.exec(instance.run.stdout) ?? [];
    const connection = record(
      JSON.parse(await readFile(connectionPath, 'utf8')),
    );
    expect(connection.surface).toBe('web');
    expect(connection.webUrl).toBe(instance.detail.web);
    expect(connection.serverUrl).toBe(instance.detail.address);
    expect(connection.webSocketUrl).toBe(
      text(instance.detail.web).replace(/^http/, 'ws') + '/api/live',
    );
    expect(connection.webMode).toBe('test');
    expect(connection.initialRoute).toBe(
      `/${text(instance.detail.projectId)}/${text(instance.detail.worktreeId)}`,
    );
    expect(record(connection.requiredOrigin)).toStrictEqual({
      http: instance.detail.web,
      webSocket: instance.detail.web,
    });
    expect(record(connection.fixtures).repositoryPath).toBe(
      instance.detail.repository,
    );
    expect(record(connection.pairing).command).toContain(
      "'pairing-link' '--instance'",
    );
    expect(record(connection.remote).startCommand).toContain(
      "'remote' 'start' '--instance'",
    );
    expect((await stat(connectionPath)).mode & 0o777).toBe(0o600);
    expect(instance.detail).not.toHaveProperty('session');
    expect(existsSync(join(instance.evidence, 'browser.json'))).toBe(false);
    const owned = list(
      JSON.parse(
        await readFile(join(dirname(instance.file), 'processes.json'), 'utf8'),
      ),
    ).map(record);
    expect(
      owned.some((process) =>
        /cliDaemon|chromium|chrome-headless/i.test(text(process.command)),
      ),
    ).toBe(false);
    const vite = await fetch(text(connection.webUrl) + '/src/main.tsx');
    expect(vite.status).toBe(200);
    expect(vite.headers.get('content-type')).toContain('javascript');
    const health = await fetch(text(connection.webUrl) + '/api/health');
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toContain('application/json');
    const status = printed(await web('status'));
    expect(record(status).alive).toBe(true);
    expect(record(status).connectionPath).toBe(connectionPath);
    expect((await web('logs')).code).toBe(0);

    const first = await web('pairing-link');
    const second = await web('pairing-link');
    expect(first.code).toBe(0);
    const link = new URL(first.stdout.trim());
    expect(link.origin).toBe(connection.webUrl);
    expect(link.pathname).toBe('/pair');
    const fragment = new URLSearchParams(link.hash.slice(1));
    const code = fragment.get('c') ?? '';
    expect(code).toMatch(/^pcp_/);
    expect(fragment.get('e')).toBe(record(connection.fixtures).environmentId);
    expect(second.stdout).not.toBe(first.stdout);
    const stopped = await web('stop');
    expect(stopped.code).toBe(0);
    expect(existsSync(dirname(instance.file))).toBe(false);
    expect(
      await fetch(text(connection.webUrl)).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      await fetch(text(connection.serverUrl)).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    const evidence = await evidenceOf(instance.evidence);
    expect(evidence.text).toContain('/pair#c=[redacted]&e=');
    expect(evidence.text).not.toContain(code);
    expect((await web('evidence')).stdout.trim()).toBe(instance.evidence);
    expect((await web('stop')).stdout).toContain(
      `already stopped ${instance.id}`,
    );
  },
  WEB_CASE_MS,
);

test(
  'concurrent web commands each record their own numbered evidence file',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });

    const runs = await Promise.all(
      Array.from({ length: 4 }, () =>
        cli(
          repositoryRoot,
          WEB_CLI,
          'server',
          'project',
          '--instance',
          instance.id,
        ),
      ),
    );
    await cli(repositoryRoot, WEB_CLI, 'stop', '--instance', instance.id);
    const evidence = await evidenceOf(instance.evidence);

    expect(runs.map((run) => run.code)).toStrictEqual([0, 0, 0, 0]);
    expect(evidence.numbered).toStrictEqual([
      '001-start.json',
      '002-server-project.json',
      '003-server-project.json',
      '004-server-project.json',
      '005-server-project.json',
    ]);
  },
  WEB_CASE_MS,
);

test(
  'an agent comment sent through the web CLI reaches the disposable MCP route and typed readback',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    const body = 'Sent through the web CLI as the agent';

    const sent = await web('agent', 'comment', 'README.md', body);
    const threads = list(printed(await web('server', 'comment-threads')));
    const evidence = await evidenceOf(instance.evidence);

    expect(sent.code).toBe(0);
    expect(threads.map((thread) => record(thread).anchor)).toStrictEqual([
      { kind: 'file', filePath: 'README.md' },
    ]);
    expect(
      list(record(threads[0]).messages).map((message) => {
        const { author, body: said } = record(message);
        return { author, said };
      }),
    ).toStrictEqual([{ author: 'agent', said: body }]);
    expect(evidence.text).toContain(body);
    expect(evidence.numbered).toContain('002-agent-comment.json');
  },
  WEB_CASE_MS,
);

test(
  'the web CLI prints the second computer’s pairing link and keeps it and that computer’s credentials out of its evidence',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    const remote = await web('remote', 'start');
    const issued = await web('remote', 'pairing-link');
    const [link = ''] = issued.stdout.split('\n');
    const code = decodeURIComponent(/#c=([^&]+)/.exec(link)?.[1] ?? '');
    const secrets = list(
      record(JSON.parse(await readFile(instance.file, 'utf8'))).secrets,
    ).map(text);
    const added = secrets.filter(
      (secret) => !instance.secrets.includes(secret),
    );

    await web('stop');
    const evidence = await evidenceOf(instance.evidence);

    expect(remote.code).toBe(0);
    expect(evidence.numbered).toContain('003-remote-pairing-link.json');
    expect(code, 'the link is printed for the next step').toMatch(/^pcp_/);
    expect(added, 'the second computer’s credentials').toHaveLength(2);
    expect(
      record(
        JSON.parse(
          await readFile(
            join(instance.evidence, '003-remote-pairing-link.json'),
            'utf8',
          ),
        ),
      ).output,
    ).toBe('[redacted]\n');
    expect(
      [...secrets, code].filter((secret) => evidence.text.includes(secret)),
      'no credential or code in the evidence',
    ).toStrictEqual([]);
    expect(
      secrets.filter(
        (secret) =>
          remote.stdout.includes(secret) || issued.stdout.includes(secret),
      ),
      'no credential printed',
    ).toStrictEqual([]);
  },
  WEB_CASE_MS,
);
