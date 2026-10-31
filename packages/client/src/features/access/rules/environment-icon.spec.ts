import { describe, expect, it } from 'vitest';
import {
  chosenEnvironmentIcon,
  environmentIcon,
  environmentIconLabels,
  environmentIcons,
} from './environment-icon.ts';

describe('environmentIcon', () => {
  it('shows a desktop until an icon is chosen', () => {
    expect(environmentIcon({})).toBe('desktop');
  });

  it('shows the chosen icon', () => {
    expect(environmentIcon({ icon: 'laptop' })).toBe('laptop');
  });
});

describe('chosenEnvironmentIcon', () => {
  it('clears the choice when the desktop is picked, so the computer goes back to the default', () => {
    expect(chosenEnvironmentIcon('desktop')).toBeNull();
  });

  it('keeps any other icon as the choice', () => {
    expect(chosenEnvironmentIcon('laptop')).toBe('laptop');
    expect(chosenEnvironmentIcon('server')).toBe('server');
    expect(chosenEnvironmentIcon('cloud')).toBe('cloud');
  });
});

describe('environmentIconLabels', () => {
  it('names every icon in the picker, the default first', () => {
    expect(
      environmentIcons.map((icon) => environmentIconLabels[icon]),
    ).toStrictEqual(['Desktop', 'Laptop', 'Server', 'Cloud']);
  });
});
