import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from './id';

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the browser UUID implementation when available', () => {
    const randomUUID = vi.fn(() => 'secure-id');
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn(),
      randomUUID,
    });

    expect(createId()).toBe('secure-id');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a valid UUID when randomUUID is unavailable on a LAN origin', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      },
    });

    const id = createId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
  });
});
