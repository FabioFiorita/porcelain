import { z } from 'zod';
import {
  buildCommand,
  nativeFingerprint,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { hashOf } from '../../server-verify/scripts/core/fingerprint.ts';
import {
  Registry,
  repositoryRoot,
} from '../../server-verify/scripts/core/registry.ts';

export function scriptFingerprint(): string {
  return hashOf(repositoryRoot, [
    'apps/mobile/src',
    'packages/client/src',
    'packages/theme',
  ]);
}

export const registry = new Registry({
  name: 'mobile',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: z.object({
    kind: z.enum(['iphone', 'ipad']),
    udid: z.string(),
    simulator: z.string(),
    session: z.string(),
    metro: z.string(),
    server: z.string(),
    manifest: z.string(),
    repository: z.string(),
    native: z.string(),
    script: z.string(),
  }),
  inputs: { roots: ['apps/mobile/spec/kit'], apps: [] },
  format: 'text',
  stale: (instance, changed) => {
    if (nativeFingerprint() !== instance.detail.native)
      return `Native code changed since instance ${instance.id} started; a JavaScript change refreshes through Metro, but this one needs a native rebuild. Run stop, ${buildCommand}, then start again.`;
    return changed
      ? `Server or CLI code changed since instance ${instance.id} started; run stop and start again so the evidence shows the code you changed.`
      : undefined;
  },
  stopWithinMs: 60_000,
});

export type MobileInstance = ReturnType<typeof registry.chosen>;
