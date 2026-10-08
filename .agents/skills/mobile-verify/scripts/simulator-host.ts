import { Schema } from 'effect';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  bootSimulator,
  releaseSimulator,
  resetApp,
  simulatorSchema,
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import {
  developmentClient,
  identity,
  nativeFingerprint,
} from '../../../../apps/mobile/spec/kit/development-client.ts';

const requestSchema = Schema.Struct({
  action: Schema.Literals(['prepare', 'release']),
  kind: Schema.Literals(['iphone', 'ipad']),
  owner: Schema.String,
  fingerprint: Schema.String,
  udid: Schema.optional(Schema.String),
  limit: Schema.Finite,
});
export type HostRequest = typeof requestSchema.Type;
export async function simulatorHost(request: HostRequest) {
  const file = join('/tmp/porcelain-simulator-pool', `${request.owner}.json`);
  if (request.action === 'release') {
    const simulator = Schema.decodeUnknownSync(simulatorSchema)(
      JSON.parse(await readFile(file, 'utf8')),
    );
    if (simulator.owner !== request.owner)
      throw new Error('The simulator claim belongs to another run.');
    await releaseSimulator(simulator);
    await rm(file);
    return { ...simulator, installed: false };
  }
  if ((await nativeFingerprint()) !== request.fingerprint)
    throw new Error(
      'The device-host checkout has different native inputs; use a matching checkout.',
    );
  const client = await developmentClient();
  if (client === undefined)
    throw new Error(
      'Build the matching development client on the Mac before starting.',
    );
  const simulator = await bootSimulator(
    request.kind,
    request.owner,
    request.udid,
    request.limit,
  );
  try {
    const installed = await resetApp(
      simulator.udid,
      client,
      identity.bundleIdentifier,
    );
    await writeFile(file, JSON.stringify(simulator), { mode: 0o600 });
    return { ...simulator, installed };
  } catch (error) {
    await releaseSimulator(simulator);
    throw error;
  }
}
if (process.argv[1] === import.meta.filename) {
  const request = Schema.decodeUnknownSync(requestSchema)(
    JSON.parse(process.argv[2] ?? '{}'),
  );
  const simulator = await simulatorHost(request);
  process.stdout.write(`${JSON.stringify(simulator)}\n`);
  if (request.action === 'prepare') {
    process.stdin.resume();
    await new Promise<void>((done) => process.stdin.once('end', done));
    await simulatorHost({ ...request, action: 'release' });
  }
}
