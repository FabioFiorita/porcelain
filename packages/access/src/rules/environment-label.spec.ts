import { describe, expect, it } from 'vitest';
import { environmentLabel } from './environment-label.ts';

describe('environmentLabel', () => {
  it('names the environment after the host and leaves the icon out until they are chosen', () => {
    expect(
      environmentLabel({ name: undefined, icon: undefined }, 'linux-desktop'),
    ).toStrictEqual({ name: 'linux-desktop', custom: false });
  });

  it('labels the environment with the chosen name and icon', () => {
    expect(
      environmentLabel(
        { name: 'Workstation', icon: 'server' },
        'linux-desktop',
      ),
    ).toStrictEqual({ name: 'Workstation', custom: true, icon: 'server' });
  });
});
