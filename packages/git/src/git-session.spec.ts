import { expect, it } from 'vitest';
import { RequestGitSession } from './git-session.ts';

function counting(fail = false) {
  const calls: string[] = [];
  const session = new RequestGitSession(async (checkout) => {
    calls.push(checkout);
    if (fail) throw new Error('identity changed');
  });
  return { calls, session };
}

it('verifies a checkout once, however many commands a request runs', async () => {
  const { calls, session } = counting();
  const checkout = session.checkout('/repo', 'metadata', 'repository');
  await checkout.verify();
  await checkout.verify();
  await checkout.verify();
  expect(calls).toEqual(['/repo']);
});

it('refuses the request when the checkout fails its first verification', async () => {
  const { calls, session } = counting(true);
  const checkout = session.checkout('/repo', 'metadata', 'repository');
  await expect(checkout.verify()).rejects.toThrow('identity changed');
  // A failed guard is never remembered as a passing one.
  await expect(checkout.verify()).rejects.toThrow('identity changed');
  expect(calls).toEqual(['/repo', '/repo']);
});

it('verifies again when a result is about to escape the request', async () => {
  const { calls, session } = counting();
  const checkout = session.checkout('/repo', 'metadata', 'repository');
  await checkout.verify();
  await checkout.confirm();
  await checkout.verify();
  expect(calls).toEqual(['/repo', '/repo']);
});

it('keeps each repository in a request separately guarded', async () => {
  const { calls, session } = counting();
  await session.checkout('/one', 'metadata-one', 'repository-one').verify();
  await session.checkout('/two', 'metadata-two', 'repository-two').verify();
  await session.checkout('/one', 'metadata-one', 'repository-one').verify();
  expect(calls).toEqual(['/one', '/two']);
  await session.confirmAll();
  expect(calls).toEqual(['/one', '/two', '/one', '/two']);
});

it('does not vouch for a checkout at the same path with a different identity', async () => {
  const { calls, session } = counting();
  await session.checkout('/repo', 'metadata', 'repository').verify();
  await session.checkout('/repo', 'replaced', 'repository').verify();
  expect(calls).toEqual(['/repo', '/repo']);
});

it('reads the conversion filters once per request', async () => {
  const { session } = counting();
  const checkout = session.checkout('/repo', 'metadata', 'repository');
  let reads = 0;
  const read = async () => {
    reads += 1;
    return ['filter.probe.clean='];
  };
  expect(await checkout.conversionFilters(read)).toEqual([
    'filter.probe.clean=',
  ]);
  expect(await checkout.conversionFilters(read)).toEqual([
    'filter.probe.clean=',
  ]);
  expect(reads).toBe(1);
});
