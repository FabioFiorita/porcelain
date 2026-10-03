import type { DefaultRoute } from '../../src/models/remote-access.ts';

export const HOME_ROUTER_HARDWARE = 'a4:91:b1:0c:7e:11';

export function routesVia(
  interfaceName: string,
  gatewayHardware?: string,
): DefaultRoute[] {
  return [
    {
      interfaceName,
      metric: 600,
      gateway: '192.168.1.1',
      ...(gatewayHardware === undefined ? {} : { gatewayHardware }),
    },
  ];
}
