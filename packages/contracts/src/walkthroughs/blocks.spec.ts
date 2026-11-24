import { Schema } from 'effect';
import { expect, it } from 'vite-plus/test';
import {
  walkthroughBlockRequestSchema,
  walkthroughBlockSchema,
} from './index.ts';

it('exposes recorded check results on the wire and only accepts the commit as a request', () => {
  const block = {
    kind: 'checks',
    headOid: 'captured-head',
    state: 'SUCCESS',
    results: [{ name: 'Tests', status: 'SUCCESS' }],
  };
  expect(Schema.decodeUnknownSync(walkthroughBlockSchema)(block)).toEqual({
    kind: 'checks',
    headOid: 'captured-head',
    state: 'SUCCESS',
    results: [{ name: 'Tests', status: 'SUCCESS' }],
  });
  const decodeRequest = Schema.decodeUnknownSync(
    walkthroughBlockRequestSchema,
    {
      onExcessProperty: 'error',
    },
  );
  expect(decodeRequest({ kind: 'checks', headOid: 'captured-head' })).toEqual({
    kind: 'checks',
    headOid: 'captured-head',
  });
  expect(() => decodeRequest(block)).toThrow();
});
