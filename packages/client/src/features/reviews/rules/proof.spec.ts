import { expect, it } from 'vitest';
import { orderedChecks, type ProofCheck } from './proof.ts';

it('orders failures before skips and passes without modern array methods or changing the input', () => {
  const checks: readonly ProofCheck[] = Object.freeze([
    { name: 'first pass', result: 'pass' },
    { name: 'skip', result: 'skipped' },
    { name: 'failure', result: 'fail' },
    { name: 'second pass', result: 'pass' },
  ]);
  const descriptor = Object.getOwnPropertyDescriptor(
    Array.prototype,
    'toSorted',
  );
  Reflect.deleteProperty(Array.prototype, 'toSorted');
  try {
    expect(orderedChecks(checks).map((check) => check.name)).toEqual([
      'failure',
      'skip',
      'first pass',
      'second pass',
    ]);
    expect(checks.map((check) => check.name)).toEqual([
      'first pass',
      'skip',
      'failure',
      'second pass',
    ]);
    expect(orderedChecks([])).toEqual([]);
  } finally {
    if (descriptor)
      Object.defineProperty(Array.prototype, 'toSorted', descriptor);
  }
});
