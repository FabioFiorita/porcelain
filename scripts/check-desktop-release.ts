import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const image = process.argv[2];
if (!image) throw new Error('Pass the signed Porcelain disk image');

const workspace = mkdtempSync('/tmp/porcelain-release-');
const mount = join(workspace, 'image');
const profile = join(workspace, 'profile');
const projects = join(workspace, 'projects');
const home = join(workspace, 'home');
let mounted = false;

try {
  for (const path of [mount, profile, projects, home]) mkdirSync(path);
  execFileSync(
    'hdiutil',
    ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image],
    { stdio: 'inherit' },
  );
  mounted = true;
  const app = spawn(
    join(mount, 'Porcelain.app', 'Contents', 'MacOS', 'Porcelain'),
    ['--data-directory', profile, '--project-home', projects],
    {
      env: {
        ...process.env,
        HOME: home,
        PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
      },
      stdio: 'inherit',
    },
  );
  const exited = new Promise<string>((resolve) => {
    app.once('error', (error) => resolve(error.message));
    app.once('close', (code, signal) => resolve(String(code ?? signal)));
  });
  const windowProbe = new AbortController();
  try {
    if (app.pid === undefined)
      throw new Error(
        `The mounted Porcelain app did not launch (${await exited})`,
      );
    await Promise.race([
      run(
        'swift',
        [
          '-e',
          String.raw`
import CoreGraphics
import Foundation

let pid = ${app.pid}
let deadline = ProcessInfo.processInfo.systemUptime + 30
while ProcessInfo.processInfo.systemUptime < deadline {
    let windows = CGWindowListCopyWindowInfo(
        [.optionOnScreenOnly, .excludeDesktopElements],
        kCGNullWindowID
    ) as? [[String: Any]] ?? []
    let visible = windows.contains { window in
        guard window[kCGWindowOwnerPID as String] as? Int == pid,
              window[kCGWindowLayer as String] as? Int == 0,
              let bounds = window[kCGWindowBounds as String] as? [String: Double],
              let width = bounds["Width"], let height = bounds["Height"] else { return false }
        return width >= 800 && height >= 600
    }
    if visible { exit(0) }
    Thread.sleep(forTimeInterval: 0.25)
}
FileHandle.standardError.write(Data("Porcelain did not show its main window.\n".utf8))
exit(1)
`,
        ],
        { signal: windowProbe.signal, timeout: 60_000 },
      ),
      exited.then((reason) => {
        throw new Error(
          `Porcelain exited before showing its main window (${reason})`,
        );
      }),
    ]);
    console.log('The mounted Porcelain app showed its main window.');
  } finally {
    windowProbe.abort();
    app.kill();
    const stopped = await Promise.race([
      exited.then(() => true),
      setTimeout(5_000, false, { ref: false }),
    ]);
    if (!stopped) {
      app.kill('SIGKILL');
      await exited;
    }
  }
} finally {
  if (mounted) execFileSync('hdiutil', ['detach', mount], { stdio: 'inherit' });
  rmSync(workspace, { recursive: true, force: true });
}
