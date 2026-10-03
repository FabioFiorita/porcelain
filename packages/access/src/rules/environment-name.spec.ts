import { describe, expect, it } from 'vitest';
import { environmentName } from './environment-name.ts';

describe('environmentName', () => {
  it('names the environment after the host until a name is chosen', () => {
    expect(environmentName({ name: undefined }, 'studio-desktop')).toEqual({
      name: 'studio-desktop',
      custom: false,
    });
  });

  it('answers the chosen name over the host name', () => {
    expect(environmentName({ name: 'Workstation' }, 'studio-desktop')).toEqual({
      name: 'Workstation',
      custom: true,
    });
  });
});
