import { describe, expect, it } from 'vitest';
import { perConnection } from './per-connection.ts';

describe('perConnection', () => {
  it('shares one API across contexts for the same remote transport', () => {
    const api = perConnection((transport) => ({ transport }));
    const transport = () => Promise.resolve(Response.json({}));
    expect(api({ transport })).toBe(api({ transport }));
  });

  it('keeps APIs for different remote environments separate', () => {
    const api = perConnection((transport) => ({ transport }));
    const first = () => Promise.resolve(Response.json({}));
    const second = () => Promise.resolve(Response.json({}));
    expect(api({ transport: first })).not.toBe(api({ transport: second }));
    expect(api({ transport: first }).transport).toBe(first);
    expect(api({ transport: second }).transport).toBe(second);
  });
});
