import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { arch, platform, release } from 'node:os';
export function runtimeFingerprint(): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        platform: platform(),
        arch: arch(),
        release: release(),
        node: process.version,
        git: execFileSync('git', ['--version', '--build-options'], {
          encoding: 'utf8',
        }),
        openssl: execFileSync('openssl', ['version'], { encoding: 'utf8' }),
        configuration: execFileSync('git', ['config', '--null', '--list'], {
          encoding: 'utf8',
        }),
        environment: Object.fromEntries(
          Object.entries(process.env).filter(([key]) =>
            /^(GIT_|SSH_|LANG$|LC_|ImageOS$|ImageVersion$)/.test(key),
          ),
        ),
      }),
    )
    .digest('hex');
}
