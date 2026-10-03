import type { DefaultRoute } from '@porcelain/access/models';

const ANY_DESTINATION = '00000000';
const HARDWARE = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/;
const NO_HARDWARE = '00:00:00:00:00:00';
const ROUTE_UP = 1;

function routeAddress(hex: string | undefined): string {
  return (hex?.match(/[0-9A-Fa-f]{2}/g) ?? [])
    .map((pair) => Number(`0x${pair}`))
    .reverse()
    .join('.');
}

function gatewayHardware(
  neighbourTable: string,
  gateway: string,
  interfaceName: string,
): string | undefined {
  return neighbourTable
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([address, , , , , device]) =>
        address === gateway && device === interfaceName,
    )
    .map(([, , , hardware]) => hardware?.toLowerCase() ?? '')
    .find((hardware) => HARDWARE.test(hardware) && hardware !== NO_HARDWARE);
}

export function linuxDefaultRoutes(
  routeTable: string,
  neighbourTable: string,
): DefaultRoute[] {
  return routeTable
    .split('\n')
    .slice(1)
    .flatMap((line) => {
      const [interfaceName, destination, gatewayHex, flags, , , metric, mask] =
        line.trim().split(/\s+/);
      const up = (Number(`0x${flags ?? ''}`) & ROUTE_UP) === ROUTE_UP;
      const order = Number(metric);
      if (
        !interfaceName ||
        destination !== ANY_DESTINATION ||
        mask !== ANY_DESTINATION ||
        !up ||
        !Number.isInteger(order)
      )
        return [];
      const gateway = routeAddress(gatewayHex);
      const hardware = gatewayHardware(neighbourTable, gateway, interfaceName);
      return [
        {
          interfaceName,
          metric: order,
          gateway,
          ...(hardware === undefined ? {} : { gatewayHardware: hardware }),
        },
      ];
    });
}
