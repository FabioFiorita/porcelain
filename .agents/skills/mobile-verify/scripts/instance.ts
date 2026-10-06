import { Schema } from 'effect';
import {
  buildCommand,
  nativeFingerprint,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { hashOf } from '../../verify-core/fingerprint.ts';
import { Registry, repositoryRoot } from '../../verify-core/registry.ts';
import { hostDetail } from './host.ts';
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
  detail: Schema.Struct({
    kind: Schema.Literals(['iphone', 'ipad']),
    udid: Schema.String,
    simulator: Schema.String,
    session: Schema.String,
    metro: Schema.String,
    server: Schema.String,
    manifest: Schema.String,
    repository: Schema.String,
    native: Schema.String,
    script: Schema.String,
    host: hostDetail,
  }),
  inputs: { roots: ['apps/mobile/spec/kit'], apps: [] },
  format: 'text',
  stale: async (instance, changed) => {
    if ((await nativeFingerprint()) !== instance.detail.native)
      return `Native code changed since instance ${instance.id} started; a JavaScript change refreshes through Metro, but this one needs a native rebuild. Run stop, ${buildCommand}, then start again.`;
    return changed
      ? `Server or CLI code changed since instance ${instance.id} started; run stop and start again so the evidence shows the code you changed.`
      : undefined;
  },
  stopWithinMs: 60_000,
});
export type MobileInstance = ReturnType<typeof registry.chosen>;
