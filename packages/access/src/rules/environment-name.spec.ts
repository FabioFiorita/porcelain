import { describe, expect, it } from 'vitest';
import { environmentName } from './environment-name.ts';

describe('environmentName', () => {
  it('names the environment after the host until a name is chosen', () => {
    expect(environmentName({ name: undefined }, 'fabio-desktop')).toEqual({
      name: 'fabio-desktop',
      custom: false,
    });
  });

  it('answers the chosen name over the host name', () => {
    expect(environmentName({ name: 'Workstation' }, 'fabio-desktop')).toEqual({
      name: 'Workstation',
      custom: true,
    });
  });
});
