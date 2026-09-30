import {
  issuePairingResponseSchema,
  pairingLink,
  listAccessResponseSchema,
  revokeAccessResponseSchema,
  setDeviceTrustResponseSchema,
} from '@porcelain/contracts/access';
import {
  DEVICE_LABEL_LENGTH,
  DEVICE_PLATFORM_LENGTH,
} from '@porcelain/contracts/shared';
import qrcode from 'qrcode-terminal';
import { MINUTE_MS, type Limits } from '../config/limits.ts';
import { askOwner } from './owner-client.ts';

type Output = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

function printable(value: string, limit = DEVICE_PLATFORM_LENGTH): string {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
    ({ segment }) => {
      return /\p{Cc}/u.test(segment) ? '?' : segment;
    },
  )
    .slice(0, limit)
    .join('');
}

function qr(link: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(link, { small: true }, (code: string) => resolve(code));
  });
}

type PairingRequest = {
  labels: readonly string[];
  addresses: readonly string[];
  trusted: boolean;
};

export async function issuePairings(
  dataDirectory: string,
  pairing: PairingRequest,
  output: Output,
  limits: Limits,
  withQr = true,
): Promise<void> {
  const minutes = limits.access.pairingGrant.lifetimeMs / MINUTE_MS;
  const answer = issuePairingResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'POST',
      '/pairings',
      pairing,
      limits.owner.requestTimeoutMs,
    ),
  );
  for (const grant of answer.grants) {
    output.stdout(`${printable(grant.grant.label, DEVICE_LABEL_LENGTH)}\n`);
    const link = pairingLink(grant.link);
    output.stdout(`${link}\n`);
    if (withQr) output.stdout(`${await qr(link)}\n`);
    output.stdout(`Expires ${grant.grant.expiresAt}\n\n`);
  }
  output.stdout(
    answer.grants.length === 1
      ? `This link works once, for ${minutes} minutes.\n`
      : `${answer.grants.length} links, each good once for ${minutes} minutes.\n`,
  );
  if (pairing.trusted)
    output.stdout(
      'A device paired with it is trusted: it may update Porcelain.\n',
    );
}

export async function listAccess(
  dataDirectory: string,
  output: Output,
  limits: Limits,
): Promise<void> {
  const listing = listAccessResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'GET',
      '/access',
      undefined,
      limits.owner.requestTimeoutMs,
    ),
  );
  if (listing.grants.length > 0) {
    output.stdout('Pending links\n');
    for (const grant of listing.grants)
      output.stdout(
        `  ${grant.id}  ${printable(grant.label, DEVICE_LABEL_LENGTH)}  ${grant.trusted ? 'trusted  ' : ''}expires ${grant.expiresAt}\n`,
      );
    output.stdout('\n');
  }
  if (listing.devices.length === 0) {
    output.stdout('No paired devices.\n');
    return;
  }
  output.stdout('Devices\n');
  for (const device of listing.devices)
    output.stdout(
      `  ${device.id}  ${printable(device.label, DEVICE_LABEL_LENGTH)}  ${printable(device.platform)}  ` +
        `over ${device.route}${device.routeInferred ? ' (inferred)' : ''}  ` +
        `${device.trusted ? 'trusted' : 'not trusted'}  ` +
        `last seen ${device.lastSeenAt}${device.lastSeenAddress ? ` from ${printable(device.lastSeenAddress, limits.cli.printedAddressLength)}` : ''}\n`,
    );
}

export async function revokeAccess(
  dataDirectory: string,
  id: string,
  output: Output,
  limits: Limits,
): Promise<boolean> {
  const answer = revokeAccessResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'POST',
      '/access/revoke',
      { id },
      limits.owner.requestTimeoutMs,
    ),
  );
  if (!answer.revoked) {
    output.stderr(
      `Nothing to revoke for ${printable(id, limits.cli.printedIdLength)}.\n`,
    );
    return false;
  }
  output.stdout(
    answer.kind === 'grant'
      ? 'That pairing link can no longer be used.\n'
      : 'That device is revoked; anything it had open is closed.\n',
  );
  return true;
}

export async function setDeviceTrust(
  dataDirectory: string,
  change: { id: string; trusted: boolean },
  output: Output,
  limits: Limits,
): Promise<void> {
  const answer = setDeviceTrustResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'POST',
      '/access/trust',
      change,
      limits.owner.requestTimeoutMs,
    ),
  );
  output.stdout(
    answer.trusted
      ? 'That device is trusted: it may update Porcelain.\n'
      : 'That device is no longer trusted to update Porcelain.\n',
  );
}
