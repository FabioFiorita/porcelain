import { describe, expect, it } from 'vitest';
import { safeSshIdentity } from './safe-ssh-command.ts';

describe('safe SSH identity', () => {
  it('keeps a single identity file and IdentitiesOnly', () => {
    expect(
      safeSshIdentity('ssh -i ~/.ssh/github-soap -o IdentitiesOnly=yes'),
    ).toEqual({ identity: '~/.ssh/github-soap' });
  });

  it('rejects another program, a proxy, or a second identity', () => {
    expect(safeSshIdentity('nc -i ~/.ssh/key')).toBeNull();
    expect(safeSshIdentity('ssh -o ProxyCommand=nc')).toBeNull();
    expect(safeSshIdentity('ssh -i ~/.ssh/a -i ~/.ssh/b')).toBeNull();
    expect(safeSshIdentity('ssh -i ~/.ssh/../key')).toBeNull();
  });
});
