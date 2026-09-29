import { describe, expect, it } from 'vitest';
import { localNetworkNote, type RemoteAccess } from './share.ts';

const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };
const cafe = { interfaceName: 'wlp2s0', subnet: '10.20.0.0/16' };

function remote(
  lan: RemoteAccess['routes']['lan'],
  networks: Pick<RemoteAccess, 'lanNetwork' | 'localNetwork'>,
): RemoteAccess {
  const off = { enabled: false, status: { kind: 'off' as const } };
  return {
    routes: { lan, tailnet: off, cloudflare: off },
    ...networks,
    serviceUrl: 'http://127.0.0.1:4173',
  };
}

const paused = { enabled: true, status: { kind: 'paused' as const } };

describe('localNetworkNote', () => {
  it('names the one network turning the local network on would listen on', () => {
    expect(
      localNetworkNote(
        remote(
          { enabled: false, status: { kind: 'off' } },
          { localNetwork: home },
        ),
      ),
    ).toBe(
      'Turning it on listens on 192.168.1.0/24 on wlp2s0 only, and pauses on any other network.',
    );
  });

  it('says there is nothing to turn on while the computer is on no local network', () => {
    expect(
      localNetworkNote(remote({ enabled: false, status: { kind: 'off' } }, {})),
    ).toBe('This computer is not on a local network right now.');
  });

  it('names the network it listens on', () => {
    expect(
      localNetworkNote(
        remote(
          {
            enabled: true,
            status: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
          },
          { lanNetwork: home, localNetwork: home },
        ),
      ),
    ).toBe('Listening on 192.168.1.0/24 on wlp2s0 only.');
  });

  it('explains a pause on another network and where it listens again', () => {
    expect(
      localNetworkNote(
        remote(paused, { lanNetwork: home, localNetwork: cafe }),
      ),
    ).toBe(
      'Paused on this network. It was turned on for 192.168.1.0/24 on wlp2s0, and listens again there, or here once you turn it on for this network.',
    );
  });

  it('explains a pause while the computer is on no local network', () => {
    expect(localNetworkNote(remote(paused, { lanNetwork: home }))).toBe(
      'Paused: this computer is not on a local network. Porcelain listens again when it is back on 192.168.1.0/24 on wlp2s0.',
    );
  });

  it('explains the pause of a local network turned on before its network was kept', () => {
    expect(localNetworkNote(remote(paused, { localNetwork: cafe }))).toBe(
      'Paused on this network. It was turned on before Porcelain kept the network it was turned on for; turn it on for this network to listen here.',
    );
  });
});
