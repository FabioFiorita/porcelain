import {
  accessListingSchema,
  issuedGrantsSchema,
  revokedAccessSchema,
} from '@porcelain/contracts/access';
import qrcode from 'qrcode-terminal';
import { askOwner } from './owner-client.ts';

export type Output = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

function printable(value: string, limit = 120): string {
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

export async function issuePairings(
  dataDirectory: string,
  labels: readonly string[],
  addresses: readonly string[],
  output: Output,
  withQr = true,
): Promise<void> {
  const answer = issuedGrantsSchema.parse(
    await askOwner(dataDirectory, 'POST', '/pairings', { labels, addresses }),
  );
  for (const grant of answer.grants) {
    output.stdout(`${printable(grant.grant.label, 80)}\n`);
    output.stdout(`${grant.link}\n`);
    if (withQr) output.stdout(`${await qr(grant.link)}\n`);
    output.stdout(`Expires ${grant.grant.expiresAt}\n\n`);
  }
  output.stdout(
    answer.grants.length === 1
      ? 'This link works once, for fifteen minutes.\n'
      : `${answer.grants.length} links, each good once for fifteen minutes.\n`,
  );
}

export async function listAccess(
  dataDirectory: string,
  output: Output,
): Promise<void> {
  const listing = accessListingSchema.parse(
    await askOwner(dataDirectory, 'GET', '/access'),
  );
  if (listing.grants.length > 0) {
    output.stdout('Pending links\n');
    for (const grant of listing.grants)
      output.stdout(
        `  ${grant.id}  ${printable(grant.label, 80)}  expires ${grant.expiresAt}\n`,
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
      `  ${device.id}  ${printable(device.label, 80)}  ${printable(device.platform)}  ` +
        `last seen ${device.lastSeenAt}${device.lastSeenAddress ? ` from ${printable(device.lastSeenAddress, 60)}` : ''}\n`,
    );
}

export async function revokeAccess(
  dataDirectory: string,
  id: string,
  output: Output,
): Promise<boolean> {
  const answer = revokedAccessSchema.parse(
    await askOwner(dataDirectory, 'POST', '/access/revoke', { id }),
  );
  if (!answer.revoked) {
    output.stderr(`Nothing to revoke for ${printable(id, 80)}.\n`);
    return false;
  }
  output.stdout(
    answer.kind === 'grant'
      ? 'That pairing link can no longer be used.\n'
      : 'That device is revoked; anything it had open is closed.\n',
  );
  return true;
}
