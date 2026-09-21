import { spawn } from 'node:child_process';
import {
  chmod,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const packageOutput = join(repositoryRoot, 'dist-porcelain');

const runtimeDependencies = [
  '@fastify/type-provider-zod',
  '@fastify/websocket',
  '@modelcontextprotocol/sdk',
  '@parcel/watcher',
  'better-sqlite3',
  'drizzle-orm',
  'fastify',
  'qrcode-terminal',
  'trash',
  'ws',
  'zod',
] as const;

const license = `MIT License

Copyright (c) 2026 Fabio Fiorita

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const binSource = `#!/usr/bin/env node
import { runCli } from '../server/src/cli/main.mjs';

await runCli();
`;

type PackageJson = {
  version?: string;
  description?: string;
  license?: string;
  author?: string | { name?: string; email?: string };
  repository?: unknown;
  bugs?: unknown;
  homepage?: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
};

function pnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function runCommand(command: string, args: readonly string[]) {
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      stdio: 'inherit',
    });
    child.once('error', rejectCommand);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolveCommand();
        return;
      }
      rejectCommand(
        new Error(
          signal
            ? `${command} terminated by ${signal}`
            : `${command} exited with status ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

async function requiredFile(path: string): Promise<void> {
  try {
    const metadata = await stat(path);
    if (!metadata.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Required packaging input is missing: ${path}`);
  }
}

async function requiredDirectory(path: string): Promise<void> {
  try {
    const metadata = await stat(path);
    if (!metadata.isDirectory()) throw new Error('not a directory');
  } catch {
    throw new Error(`Required packaging input is missing: ${path}`);
  }
}

async function readJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageJson;
}

async function buildWeb(webOutput: string): Promise<void> {
  await runCommand(pnpmCommand(), [
    '--filter',
    '@porcelain/web',
    'exec',
    'tsc',
    '--noEmit',
  ]);
  await runCommand(pnpmCommand(), [
    '--filter',
    '@porcelain/web',
    'exec',
    'vite',
    'build',
    '--outDir',
    webOutput,
    '--emptyOutDir',
  ]);
}

async function buildServer(serverOutput: string): Promise<void> {
  await mkdir(dirname(serverOutput), { recursive: true });
  await build({
    entryPoints: [join(repositoryRoot, 'apps/server/src/cli/main.ts')],
    outfile: serverOutput,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: [...runtimeDependencies],
    sourcemap: false,
    logLevel: 'info',
  });
}

function packageReadme(version: string): string {
  return `# @fabiofiorita/porcelain (${version})

The Porcelain review server and bundled web app for a plain Node installation.

## Quick start

The host needs Node 24+, Git, and a native build environment for the
\`better-sqlite3\` dependency:

\`\`\`sh
npx @fabiofiorita/porcelain@latest serve

# Permit other devices on the local network to connect:
npx @fabiofiorita/porcelain@latest serve --lan

# Install this exact CLI version as a user service:
npx @fabiofiorita/porcelain@latest service install --lan
\`\`\`

State lives in \`~/.porcelain/\`; pass \`--data-directory\` to keep it somewhere
else. Use \`porcelain serve --help\` for all options.

Nothing can reach the server until you pair a device. On the machine running
it, \`porcelain pair "Phone" --address <the address serve printed>\` prints a
link that works once; open it on the device itself. The address must be one
this server answers at, and the not-paired screen in the browser shows the
whole command with that device's own origin already filled in. \`porcelain devices\` lists what is paired and
\`porcelain revoke <id>\` ends it. Coding agents connect over MCP with
\`porcelain mcp\`, which needs no credential: it reaches a local socket only a
process on this machine can open.

## Background service

\`porcelain service install|status|update|uninstall\` manages a systemd user
service on Linux or a LaunchAgent on macOS. Install and update persist the
invoked package version outside the npx cache. Updates stop the service and
back up SQLite before the new runtime can migrate it. An older CLI refuses to
replace a newer runtime unless \`service update --allow-downgrade\` is explicit.
Uninstall removes the service and runtime while retaining data, configuration,
logs and database backups. Run service commands as the regular user, never
with sudo. On macOS the LaunchAgent runs only while that user is logged in.

## Repository development

\`\`\`sh
pnpm build:package

# Inspect the exact publishable archive:
cd dist-porcelain && npm pack
\`\`\`

\`dist-porcelain/\` is generated from a completed web and server build. Do not
edit it by hand.
`;
}

/** Build the ignored, npm-publishable package and return its directory. */
export async function buildPackage(): Promise<string> {
  const rootPackage = await readJson(join(repositoryRoot, 'package.json'));
  const serverPackage = await readJson(
    join(repositoryRoot, 'apps/server/package.json'),
  );
  for (const input of [
    join(repositoryRoot, 'apps/web/index.html'),
    join(repositoryRoot, 'apps/server/drizzle/0000_current-schema.sql'),
    join(repositoryRoot, 'apps/server/drizzle/meta/_journal.json'),
  ])
    await requiredFile(input);
  await requiredDirectory(join(repositoryRoot, 'apps/server/drizzle/meta'));

  const dependencies: Record<string, string> = {};
  for (const name of runtimeDependencies) {
    const version = serverPackage.dependencies?.[name];
    if (version === undefined || version.startsWith('workspace:'))
      throw new Error(
        `Runtime dependency ${name} must be pinned in apps/server/package.json`,
      );
    dependencies[name] = version;
  }

  await rm(packageOutput, { recursive: true, force: true });
  await mkdir(packageOutput, { recursive: true });

  // Keep the same `.../web/dist` relative layout as the source launcher. This
  // lets the bundled runtime resolve its web root from import.meta.url without
  // consulting the caller's cwd.
  const webOutput = join(packageOutput, 'web/dist');
  const serverOutput = join(packageOutput, 'server/src/cli/main.mjs');
  await buildWeb(webOutput);
  await requiredFile(join(webOutput, 'index.html'));
  await buildServer(serverOutput);
  await cp(
    join(repositoryRoot, 'apps/server/drizzle'),
    join(packageOutput, 'server/drizzle'),
    { recursive: true },
  );

  const packageJson = {
    name: '@fabiofiorita/porcelain',
    version: rootPackage.version ?? '0.0.0',
    description:
      rootPackage.description ??
      'Porcelain review server and bundled web application',
    license: rootPackage.license ?? 'MIT',
    ...(rootPackage.author === undefined ? {} : { author: rootPackage.author }),
    ...(rootPackage.repository === undefined
      ? {}
      : { repository: rootPackage.repository }),
    ...(rootPackage.bugs === undefined ? {} : { bugs: rootPackage.bugs }),
    ...(rootPackage.homepage === undefined
      ? {}
      : { homepage: rootPackage.homepage }),
    type: 'module',
    engines: rootPackage.engines ?? { node: '>=24.20.0 <25 || >=26.8.1 <27' },
    bin: { porcelain: 'bin/porcelain.js' },
    files: ['bin', 'server', 'web', 'README.md', 'LICENSE'],
    dependencies,
    publishConfig: { access: 'public' },
  };
  await mkdir(join(packageOutput, 'bin'), { recursive: true });
  await writeFile(join(packageOutput, 'bin/porcelain.js'), binSource, {
    mode: 0o755,
  });
  await chmod(join(packageOutput, 'bin/porcelain.js'), 0o755);
  await writeFile(
    join(packageOutput, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await writeFile(
    join(packageOutput, 'README.md'),
    packageReadme(packageJson.version),
  );
  await writeFile(join(packageOutput, 'LICENSE'), license);

  return packageOutput;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const output = await buildPackage();
    process.stdout.write(`Built ${output}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Package build failed'}\n`,
    );
    process.exitCode = 1;
  }
}
